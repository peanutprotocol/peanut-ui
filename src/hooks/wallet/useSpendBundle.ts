'use client'

import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Address, Hash, Hex, TransactionReceipt } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { buildRainWithdrawTypedData } from '@/utils/rainWithdraw.utils'
import { ensureRootValidatorMigrated, isMigrationWrapperAccount } from '@/utils/kernelMigration.utils'
import { rainApi, type RainCollateralKind } from '@/services/rain'
import { useZeroDev } from '@/hooks/useZeroDev'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview, RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey, type GrantSessionKeyError } from './useGrantSessionKey'
import { usdcUnitsToRainCents } from '@/utils/balance.utils'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { smartUsdcBalanceQueryOptions } from './useBalance'

export type SpendStrategy = 'collateral-only' | 'smart-only' | 'mixed' | 'insufficient'

type UserOpEncodedParams = { to: Hex; value: bigint; data: Hex }

export interface SpendBundleInput {
    /** Total USDC (token smallest units) that must arrive / be available for the spend. */
    requiredUsdcAmount: bigint
    /** Final recipient — required when the whole spend is a plain transfer.
     *  Pass `undefined` for flows whose `subsequentCalls` already handle delivery
     *  (e.g. Peanut link creation `approve + makeDeposit`). */
    recipient?: Address
    /** Rain collateral `spendingPower` right now, in token smallest units. */
    rainSpendingPower: bigint
    /** User-semantic category of this spend (P2P_SEND, QR_PAY, CRYPTO_WITHDRAW, …).
     *  Persisted on the `TransactionIntent` the backend creates in /prepare, so
     *  the Rain collateral webhook can be reconciled and categorized correctly
     *  in history (instead of showing up as a generic "card payment"). */
    kind: RainCollateralKind
    /** When this spend pays a Peanut request/charge AND it routes entirely through
     *  Rain collateral (`collateral-only`), the charge uuid. The backend uses the
     *  charge intent itself as the prep and marks it COMPLETED on confirm — so the
     *  caller MUST skip its own `recordPayment` when `strategy === 'collateral-only'`.
     *  Ignored for `smart-only` and `mixed` (those keep the recordPayment path). */
    chargeId?: string
    /** Extra calls to include in the kernel UserOp (for approve+deposit-style flows).
     *  If present, collateral-only routing is NOT eligible — calls must run from the kernel. */
    subsequentCalls?: UserOpEncodedParams[]
    /** Fires once the routing is picked, before any signing — lets the caller update UI
     *  (e.g. show "this will take 2 taps"). */
    onStrategyDecided?: (strategy: Exclude<SpendStrategy, 'insufficient'>) => void
    /** Fires right before the one-time session-key grant prompt appears (only when
     *  the chosen strategy touches Rain collateral and approval is missing). Lets
     *  the caller show UI explaining the extra tap before the WebAuthn sheet. */
    onGrantRequired?: () => void
}

export interface SpendBundleResult {
    strategy: Exclude<SpendStrategy, 'insufficient'>
    /** Set when the final submission was a plain EVM tx (collateral-only). */
    txHash?: Hex
    /** Set when the final submission was a kernel UserOp (smart-only or mixed). */
    userOpHash?: Hash
    /** On-chain receipt when the kernel path returned one. Null on the
     *  collateral-only path (backend EVM tx; caller can look up the receipt
     *  from `txHash` if needed). */
    receipt?: TransactionReceipt | null
    /** Backend TransactionIntent id (only when strategy touched Rain: collateral-only
     *  or mixed). Use this to navigate to `/receipt/<intentId>?kind=<IntentKind>`.
     *  Undefined for smart-only — no intent is created for pure smart-account sends. */
    intentId?: string
}

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

// `usdcUnitsToRainCents` lives in @/utils/balance.utils alongside its sibling
// `rainCentsToUsdcUnits`. Rain's wire convention is asymmetric: cents (2dp)
// on INPUT to /prepare, USDC wei (PEANUT_WALLET_TOKEN_DECIMALS) on OUTPUT in
// the signed parameters (what the EIP-712 message + coordinator sign over).
// `usdcUnitsToRainCents` is for the input side only — never call it on amounts
// returned from Rain.

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

/**
 * Orchestrates a USDC outflow across the user's two buckets:
 *   - collateral-only: backend broadcasts `coordinator.withdrawAsset(directTransfer=true)`
 *     straight to the recipient. User taps passkey once (admin EIP-712).
 *   - smart-only: existing kernel UserOp path (1 passkey tap).
 *   - mixed: backend prepares a withdraw-to-smart; frontend signs admin EIP-712 (tap #1),
 *     then sends a single UserOp that bundles `[withdrawAsset(directTransfer=false),
 *     usdc.transfer(recipient), ...subsequentCalls]` (tap #2). Atomic.
 *
 * See plan file for the full rationale.
 */
export const useSpendBundle = () => {
    const { getClientForChain, rebuildClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded } = useZeroDev()
    const { user } = useAuth()
    const { overview } = useRainCardOverview()
    const { grant } = useGrantSessionKey()
    // Optional — overlay is UI polish, not correctness. If ModalsProvider
    // isn't mounted (isolated component tests, future Storybook stories,
    // etc.), the toggle silently no-ops instead of throwing and blocking
    // the actual spend. Production trees mount the provider via
    // contextProvider, so the overlay still renders end-to-end.
    const modals = useModalsContextOptional()
    const queryClient = useQueryClient()

    const spend = useCallback(
        async (input: SpendBundleInput): Promise<SpendBundleResult> => {
            const {
                requiredUsdcAmount,
                recipient,
                subsequentCalls = [],
                rainSpendingPower,
                kind,
                chargeId,
                onStrategyDecided,
                onGrantRequired,
            } = input

            const hasSubsequent = subsequentCalls.length > 0
            const collateralOnlyAllowed = !hasSubsequent && !!recipient

            const chainIdNum = PEANUT_WALLET_CHAIN.id
            const chainIdStr = chainIdNum.toString()

            // Route on the LIVE on-chain balance of the exact account that will
            // send the UserOp — never a cached value (see fetchLiveSmartUsdcBalance).
            // getClientForChain also asserts the client belongs to the logged-in
            // user, so this is the authoritative sender + balance pair.
            const kernelClient = getClientForChain(chainIdStr)
            const smartBalance = await fetchLiveSmartUsdcBalance(queryClient, kernelClient.account!.address)

            const strategy = computeSpendStrategy({
                smart: smartBalance,
                rain: rainSpendingPower,
                amount: requiredUsdcAmount,
                collateralOnlyAllowed,
            })
            if (strategy === 'insufficient') {
                posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
                    strategy: 'insufficient',
                    error_kind: 'insufficient',
                })
                // Passed the FE display gate but the live balance can't cover it yet
                // (in-transit collateral not landed / ~30s-stale FE). Refresh the Rain
                // overview so the displayed balance + a retry reflect reality.
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
                throw new InsufficientSpendableError()
            }

            onStrategyDecided?.(strategy)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, { strategy, kind })

            try {
                // Pre-flight #1 — root-validator migration (pre-2025-09-18 accounts
                // only). The mixed path pre-signs the Rain admin EIP-712 sig, but
                // an unmigrated account's userOp is auto-wrapped in a migration
                // that swaps the root validator BEFORE `withdrawAsset` verifies
                // that sig via ERC-1271 — so the op always reverts ("Delegatecall
                // failed"). Migrate first as a standalone userOp, then rebuild the
                // client so the sig is signed AND verified under v0.0.3.
                // collateral-only is exempt on purpose: it broadcasts server-side
                // with the sig checked against the CURRENT (pre-migration) state,
                // which is valid — no reason to add a passkey tap there.
                let activeClient = kernelClient
                if (strategy === 'mixed' && isMigrationWrapperAccount(kernelClient.account)) {
                    // The migration adds one passkey tap + a few seconds of
                    // confirmation wait. Show the security-verification overlay
                    // for the whole beat (same pattern as the admin-sig → userOp
                    // gap below) so the extra prompt reads as intentional.
                    modals?.setIsSecurityVerificationOpen?.(true)
                    try {
                        activeClient = await ensureRootValidatorMigrated({
                            client: kernelClient,
                            sendNoopUserOp: (call) => handleSendUserOpEncoded([call], chainIdStr),
                            rebuildClient: () => rebuildClientForChain(chainIdStr),
                            onEvent: (event) =>
                                posthog.capture(
                                    event === 'attempted'
                                        ? ANALYTICS_EVENTS.KERNEL_MIGRATION_ATTEMPTED
                                        : ANALYTICS_EVENTS.KERNEL_MIGRATION_SUCCEEDED,
                                    { trigger: 'mixed-spend', kind }
                                ),
                        })
                    } finally {
                        modals?.setIsSecurityVerificationOpen?.(false)
                    }
                }

                // Pre-flight #2: any strategy that touches Rain collateral requires
                // the one-time session-key grant. If missing, run the inline grant
                // flow now (one extra passkey tap the FIRST time, zero after).
                const touchesCollateral = strategy === 'collateral-only' || strategy === 'mixed'
                const card = findActiveCard(overview)
                if (touchesCollateral && card && !card.hasWithdrawApproval) {
                    onGrantRequired?.()
                    const grantResult = await grant()
                    if (!grantResult.ok) {
                        throw new SessionKeyGrantRequiredError(grantResult.error)
                    }
                    // `grant()` refetches the overview; by the time we continue the
                    // flag is flipped and the backend will accept the submit call.
                }

                // ─── collateral-only ──────────────────────────────────────────────
                if (strategy === 'collateral-only') {
                    const prep = await rainApi.prepareWithdrawal({
                        amount: usdcUnitsToRainCents(requiredUsdcAmount).toString(),
                        recipientAddress: recipient!,
                        directTransfer: true,
                        kind,
                        // When set, the backend completes the charge directly on
                        // confirm — caller must skip recordPayment for this strategy.
                        chargeId,
                    })

                    const adminSignature = (await activeClient.account!.signTypedData(
                        buildRainWithdrawTypedData(prep, chainIdNum)
                    )) as Hex

                    const { txHash } = await rainApi.submitWithdrawal({
                        preparationId: prep.preparationId,
                        amount: prep.amount,
                        recipientAddress: prep.recipientAddress,
                        directTransfer: prep.directTransfer,
                        adminSalt: prep.adminSalt,
                        adminNonce: prep.adminNonce,
                        adminSignature,
                        executorSignature: prep.executorSignature,
                        executorSalt: prep.executorSalt,
                        expiresAt: prep.expiresAt,
                    })
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, { strategy, kind })
                    return { strategy, txHash: txHash as Hex, intentId: prep.preparationId }
                }

                // ─── smart-only ──────────────────────────────────────────────────
                if (strategy === 'smart-only') {
                    const calls: UserOpEncodedParams[] = []
                    if (recipient) {
                        calls.push({
                            to: PEANUT_WALLET_TOKEN as Hex,
                            value: 0n,
                            data: encodeFunctionData({
                                abi: erc20Abi,
                                functionName: 'transfer',
                                args: [recipient, requiredUsdcAmount],
                            }),
                        })
                    }
                    calls.push(...subsequentCalls)
                    if (calls.length === 0) {
                        throw new Error('useSpendBundle: smart-only path needs either recipient or subsequentCalls')
                    }
                    const { userOpHash, receipt } = await handleSendUserOpEncoded(calls, chainIdStr)
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, { strategy, kind })
                    return { strategy, userOpHash, receipt }
                }

                // ─── mixed ───────────────────────────────────────────────────────
                // Pull the shortfall from collateral into the smart account, then
                // the kernel fires the USDC transfer + any subsequent calls — all in
                // one atomic UserOp. Two passkey taps total (admin sig, UserOp).

                // Admin address = user's peanut-wallet address (kernel smart account).
                const adminAddress = user?.accounts.find((a) => a.type === AccountType.PEANUT_WALLET)?.identifier as
                    | Address
                    | undefined
                if (!adminAddress) throw new Error('useSpendBundle: missing peanut-wallet address for mixed spend')

                const shortfall = requiredUsdcAmount - smartBalance
                const prep = await rainApi.prepareWithdrawal({
                    amount: usdcUnitsToRainCents(shortfall).toString(),
                    // directTransfer=false sends tokens to the admin (kernel). We still pass
                    // the admin address here; the backend + coordinator treat it as the
                    // withdraw beneficiary, which equals msg.sender-to-be in the follow-up UserOp.
                    recipientAddress: adminAddress,
                    directTransfer: false,
                    kind,
                    // History shows the full user-initiated spend, not just the
                    // shortfall Rain signed over.
                    totalAmountCents: usdcUnitsToRainCents(requiredUsdcAmount).toString(),
                })

                const adminSignature = (await activeClient.account!.signTypedData(
                    buildRainWithdrawTypedData(prep, chainIdNum)
                )) as Hex

                // Mixed = two passkey taps. The admin EIP-712 sig (tap #1) just
                // resolved; the kernel now prepares the follow-up UserOp which
                // will trigger tap #2. The gap is short but visible — show the
                // security-verification overlay so the user has something to
                // look at and the UI feels intentional rather than frozen.
                // try/finally guarantees the overlay closes on success AND on
                // bundler / kernel failure.
                modals?.setIsSecurityVerificationOpen?.(true)
                try {
                    // Backend `/prepare` normalizes the executor salt (bytes32) and signature
                    // to 0x-hex regardless of what Rain returned — trust the wire shape here.
                    const withdrawCall: UserOpEncodedParams = {
                        to: prep.coordinatorAddress as Hex,
                        value: 0n,
                        data: encodeFunctionData({
                            abi: rainCoordinatorAbi,
                            functionName: 'withdrawAsset',
                            args: [
                                prep.collateralProxy as Address,
                                prep.tokenAddress as Address,
                                BigInt(prep.amount),
                                prep.recipientAddress as Address,
                                BigInt(prep.expiresAt),
                                prep.executorSalt as Hex,
                                prep.executorSignature as Hex,
                                [prep.adminSalt as Hex],
                                [adminSignature],
                                prep.directTransfer,
                            ],
                        }),
                    }

                    const transferCall: UserOpEncodedParams | null = recipient
                        ? {
                              to: PEANUT_WALLET_TOKEN as Hex,
                              value: 0n,
                              data: encodeFunctionData({
                                  abi: erc20Abi,
                                  functionName: 'transfer',
                                  args: [recipient, requiredUsdcAmount],
                              }),
                          }
                        : null

                    const calls: UserOpEncodedParams[] = [
                        withdrawCall,
                        ...(transferCall ? [transferCall] : []),
                        ...subsequentCalls,
                    ]
                    const { userOpHash, receipt } = await handleSendUserOpEncoded(calls, chainIdStr)

                    // Stamp the intent so the Rain collateral webhook reconciles to the
                    // right category (P2P_SEND, CRYPTO_WITHDRAW, etc). Non-blocking —
                    // a stamp failure leaves the intent PENDING, which only affects
                    // history labeling, not the spend itself.
                    const mixedTxHash = (receipt?.transactionHash as Hex | undefined) ?? (userOpHash as Hex | undefined)
                    if (mixedTxHash) {
                        rainApi
                            .stampWithdrawal({ preparationId: prep.preparationId, txHash: mixedTxHash })
                            .catch(() => {})
                    }

                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, { strategy, kind })
                    return { strategy, userOpHash, receipt, intentId: prep.preparationId }
                } finally {
                    modals?.setIsSecurityVerificationOpen?.(false)
                }
            } catch (e) {
                const errorKind =
                    e instanceof SessionKeyGrantRequiredError
                        ? `session-key:${e.cause.kind}`
                        : ((e as Error)?.name ?? 'unknown')
                posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
                    strategy,
                    kind,
                    error_kind: errorKind,
                    error_message: (e as Error)?.message,
                })
                throw e
            }
        },
        [getClientForChain, rebuildClientForChain, handleSendUserOpEncoded, user, overview, grant, modals, queryClient]
    )

    return { spend }
}
