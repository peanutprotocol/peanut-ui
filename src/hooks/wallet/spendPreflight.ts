import type { QueryClient } from '@tanstack/react-query'
import type { Address, TransactionReceipt } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import type { RainCardOverview } from '@/services/rain'
import { WebAuthnErrorName } from '@/utils/webauthn.utils'
import type { GrantSessionKeyError } from './useGrantSessionKey'
import { smartUsdcBalanceQueryOptions } from './useBalance'
import {
    buildMigrationNoopCall,
    ensureRootValidatorMigrated,
    isMigrationWrapperAccount,
} from '@/utils/kernelMigration.utils'

/**
 * Shared spend-preflight for BOTH spend engines — `useSpendBundle` (sign +
 * broadcast) and `useSignSpendBundle` (sign only, backend broadcasts).
 *
 * Everything that must never drift between the two engines lives here, in one
 * ordered sequence: live-balance routing → insufficient rejection → root-
 * validator migration gate → session-key grant gate. The engines differ only
 * in how they EXECUTE the chosen strategy; they must not differ in how they
 * decide and prepare it. (This module exists because the migration-ordering
 * bug had to be fixed twice — once per engine.)
 */

export type SpendStrategy = 'collateral-only' | 'smart-only' | 'mixed' | 'insufficient'

export class InsufficientSpendableError extends Error {
    constructor() {
        super('Insufficient spendable balance')
        this.name = 'InsufficientSpendableError'
    }
}

/**
 * Thrown when the user is about to spend from Rain collateral but hasn't
 * granted the session-key permission yet, and the inline grant either failed
 * or the user cancelled the passkey. Caller can surface a friendlier UI.
 */
export class SessionKeyGrantRequiredError extends Error {
    constructor(public readonly cause: GrantSessionKeyError) {
        super(`Session-key grant required: ${cause.kind}`)
        this.name = 'SessionKeyGrantRequiredError'
    }
}

/**
 * The grant store refused the approval because the controller moved while it
 * was being saved (400 STALE_CARD_APPROVAL). A rotation CANDIDATE only — the
 * caller still has to see a real controller change before re-preparing. Every
 * other grant failure (cancelled, unexpected, no-contracts) is not this.
 */
export function isStaleGrantApproval(error: unknown): boolean {
    return error instanceof SessionKeyGrantRequiredError && error.cause.kind === 'stale-approval'
}

const CEREMONY_FAILURE_NAMES = new Set<string>(Object.values(WebAuthnErrorName))

/** The user dismissed a passkey or session-key grant prompt. */
export function isUserCancellation(error: unknown): boolean {
    if (error instanceof SessionKeyGrantRequiredError) return error.cause.kind === 'user-cancelled'
    return error instanceof Error && CEREMONY_FAILURE_NAMES.has(error.name)
}

/** Case-insensitive address equality; a missing side is never a match. */
export function sameAddress(a: string | undefined, b: string | undefined): boolean {
    return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

/**
 * Live smart-account USDC balance for ROUTING, read through the SAME TanStack
 * query that backs the displayed balance (`smartUsdcBalanceQueryOptions`) — one
 * source of truth, one `readContract`. `staleTime: 0` forces a fresh on-chain
 * read AND writes the result into `['balance', address]`, so the displayed
 * balance refreshes in the same call.
 *
 * Routing MUST use this rather than the 30s-cached `useBalance` value: card
 * funds are swept smart→collateral, so a stale (pre-sweep) balance routes
 * `smart-only` to an account that's already empty and the transfer reverts
 * on-chain ("ERC20: transfer amount exceeds balance" — incident #2230).
 */
export async function fetchLiveSmartUsdcBalance(queryClient: QueryClient, address: Address): Promise<bigint> {
    return queryClient.fetchQuery({ ...smartUsdcBalanceQueryOptions(address), staleTime: 0 })
}

/**
 * Pure routing helper — decides which bucket(s) a spend will pull from.
 * Priority: smart → collateral → mixed. The smart account is spent first
 * whenever it can cover the whole amount, so a payment never touches the
 * Rain collateral — and Rain's per-account withdrawal-signature cooldown —
 * if the user's smart-account USDC already covers it. Collateral is the
 * fallback (single recipient AND no subsequent kernel calls, since Rain's
 * coordinator transfers tokens directly with nothing following), and `mixed`
 * tops up the shortfall from collateral when smart alone can't cover it.
 */
export function computeSpendStrategy(input: {
    smart: bigint
    rain: bigint
    amount: bigint
    collateralOnlyAllowed: boolean
}): SpendStrategy {
    if (input.smart >= input.amount) return 'smart-only'
    if (input.collateralOnlyAllowed && input.rain >= input.amount) return 'collateral-only'
    if (input.smart + input.rain >= input.amount) return 'mixed'
    return 'insufficient'
}

export interface ResolveSpendStrategyArgs {
    queryClient: QueryClient
    /** The exact account that will send the UserOp — routing reads ITS live balance. */
    accountAddress: Address
    requiredUsdcAmount: bigint
    rainSpendingPower: bigint
    collateralOnlyAllowed: boolean
    /**
     * Whether `rainSpendingPower` is a real reading. When the overview is missing
     * it arrives as 0n, which is indistinguishable from "no collateral" — so a
     * Rain outage lands in the `insufficient` branch below. Blocking is still the
     * right CALL (we can't size a collateral withdrawal we can't see, and the
     * user-facing copy is already "try again in a few seconds"), but it must not
     * be REPORTED as an insufficiency or a Rain outage is invisible in analytics,
     * hidden inside the card-withdraw failure rate. Defaults to true so existing
     * callers keep their current reporting.
     */
    rainBalanceKnown?: boolean
    /** Analytics tag distinguishing the sign-only engine; omit for the broadcasting engine. */
    flow?: 'sign-only'
}

/**
 * Routes the spend on the LIVE on-chain balance and rejects unaffordable
 * spends. On `insufficient` (passed the FE display gate but the live balance
 * can't cover it yet — in-transit collateral not landed / ~30s-stale FE):
 * captures the failure, refreshes the Rain overview so the displayed balance
 * + a retry reflect reality, and throws `InsufficientSpendableError`.
 */
export async function resolveSpendStrategy(
    args: ResolveSpendStrategyArgs
): Promise<{ strategy: Exclude<SpendStrategy, 'insufficient'>; smartBalance: bigint }> {
    const {
        queryClient,
        accountAddress,
        requiredUsdcAmount,
        rainSpendingPower,
        collateralOnlyAllowed,
        rainBalanceKnown = true,
        flow,
    } = args

    const smartBalance = await fetchLiveSmartUsdcBalance(queryClient, accountAddress)
    const strategy = computeSpendStrategy({
        smart: smartBalance,
        rain: rainSpendingPower,
        amount: requiredUsdcAmount,
        collateralOnlyAllowed,
    })
    if (strategy === 'insufficient') {
        posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
            strategy: 'insufficient',
            error_kind: rainBalanceKnown ? 'insufficient' : 'rain-balance-unavailable',
            ...(flow ? { flow } : {}),
        })
        queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
        throw new InsufficientSpendableError()
    }
    return { strategy, smartBalance }
}

export interface CollateralSpendPreflightArgs<TClient extends { account?: unknown }> {
    strategy: Exclude<SpendStrategy, 'insufficient'>
    kind: string
    kernelClient: TClient
    overview: Parameters<typeof findActiveCard>[0]
    /** Sign-only engine must fail closed when the overview hasn't loaded — it
     *  can't tell whether the grant was already given, and signing
     *  optimistically would crash on the backend submission. The broadcasting
     *  engine proceeds (no card visible → nothing to grant). */
    requireOverview: boolean
    /** Sends the migration no-op userOp through the CURRENT (wrapper) client. */
    sendNoopUserOp: (call: ReturnType<typeof buildMigrationNoopCall>) => Promise<{ receipt: TransactionReceipt | null }>
    /** Rebuilds the kernel client so post-migration signatures route to v0.0.3. */
    rebuildClient: () => Promise<TClient>
    /** Security-verification overlay toggle (optional — UI polish, not correctness). */
    setSecurityOverlay?: (open: boolean) => void
    migrationTrigger: 'mixed-spend' | 'sign-spend'
}

/**
 * The collateral pre-flights, in the ONE correct order:
 *
 * 1. Root-validator migration (pre-2025-09-18 accounts only). The mixed path
 *    pre-signs the Rain admin EIP-712, but an unmigrated account's userOp is
 *    auto-wrapped in a migration that swaps the root validator BEFORE
 *    `withdrawAsset` verifies that sig via ERC-1271 — so the op always
 *    reverts ("Delegatecall failed"). Migrate first as a standalone userOp,
 *    then rebuild the client so the sig is signed AND verified under v0.0.3.
 *    `collateral-only` is exempt on purpose: its withdrawal is submitted
 *    against the CURRENT (pre-migration) on-chain state, where the old
 *    validator still verifies — no reason to add a passkey tap there.
 * 2. Overview validation for the sign-only engine.
 *
 * The session-key grant does NOT belong here: it binds to a coordinator, and
 * the prep is what states which one the withdrawal uses — see
 * `ensurePreparedControllerApproval`, which both engines call right after it.
 *
 * Returns the client every subsequent signature MUST come from (rebuilt when
 * a migration ran; the caller's original client otherwise).
 */
export async function runCollateralSpendPreflight<TClient extends { account?: unknown }>(
    args: CollateralSpendPreflightArgs<TClient>
): Promise<TClient> {
    const {
        strategy,
        kind,
        kernelClient,
        overview,
        requireOverview,
        sendNoopUserOp,
        rebuildClient,
        setSecurityOverlay,
        migrationTrigger,
    } = args

    const touchesCollateral = strategy === 'collateral-only' || strategy === 'mixed'

    // Cheap validation FIRST: never charge the user a migration passkey tap
    // for a flow that is already doomed by a missing overview.
    if (touchesCollateral && requireOverview && !overview) {
        throw new SessionKeyGrantRequiredError({ kind: 'unexpected' } as GrantSessionKeyError)
    }

    let activeClient = kernelClient
    if (strategy === 'mixed' && isMigrationWrapperAccount(kernelClient.account)) {
        // The migration adds one passkey tap + a few seconds of confirmation
        // wait. Show the security-verification overlay for the whole beat
        // (same pattern as the mixed flow's admin-sig → userOp gap) so the
        // extra prompt reads as intentional. Gated on wrapper accounts so the
        // common path never flickers.
        setSecurityOverlay?.(true)
        try {
            activeClient = await ensureRootValidatorMigrated({
                client: kernelClient,
                sendNoopUserOp,
                rebuildClient,
                onEvent: (event) =>
                    posthog.capture(
                        event === 'attempted'
                            ? ANALYTICS_EVENTS.KERNEL_MIGRATION_ATTEMPTED
                            : ANALYTICS_EVENTS.KERNEL_MIGRATION_SUCCEEDED,
                        { trigger: migrationTrigger, kind }
                    ),
            })
        } finally {
            setSecurityOverlay?.(false)
        }
    }

    return activeClient
}

/** An overview covers the prepared target only when its OWN controller is that
 *  target — a live flag read against a different controller proves nothing. */
function coversPreparedController(overview: RainCardOverview | undefined, preparedCoordinator: string): boolean {
    return (
        !!findActiveCard(overview)?.hasWithdrawApproval &&
        sameAddress(overview?.status?.coordinatorAddress, preparedCoordinator)
    )
}

export interface PreparedControllerApprovalArgs {
    /** `prep.coordinatorAddress` — the coordinator the withdrawal will target. */
    preparedCoordinator: string
    /** Cached overview; the hook's current snapshot. */
    overview: RainCardOverview | undefined
    /** Overview refetch; resolves to the newest data, or undefined when it failed. */
    refetchOverview: () => Promise<RainCardOverview | undefined>
    grant: () => Promise<{ ok: true } | { ok: false; error: GrantSessionKeyError }>
    onGrantRequired?: () => void
}

/**
 * The collateral-only grant gate, run AFTER `/prepare`. The prep states the
 * coordinator this withdrawal is built against — the backend serves it from its
 * DB record, and a rotation is caught by its verify step (RAIN_CONTROLLER_CHANGED),
 * not by a controller read on every payment. Granting BEFORE the prep could pin
 * the approval to a coordinator the withdrawal will not use.
 *
 * Returns whether a grant ran, so the caller can pick up a client the grant's
 * own migration may have rebuilt. Costs nothing when the cached overview
 * already covers the prepared controller.
 */
export async function ensurePreparedControllerApproval(
    args: PreparedControllerApprovalArgs
): Promise<{ granted: boolean }> {
    const { preparedCoordinator, overview, refetchOverview, grant, onGrantRequired } = args

    // No visible card → nothing to grant (the sign-only engine fails closed on a
    // missing overview earlier, in runCollateralSpendPreflight).
    if (!findActiveCard(overview)) return { granted: false }
    if (coversPreparedController(overview, preparedCoordinator)) return { granted: false }

    // A failed refetch resolves undefined and falls through to the grant: the
    // stale snapshot is not evidence about the prepared controller.
    if (coversPreparedController(await refetchOverview(), preparedCoordinator)) return { granted: false }

    onGrantRequired?.()
    const grantResult = await grant()
    if (!grantResult.ok) throw new SessionKeyGrantRequiredError(grantResult.error)
    return { granted: true }
}
