'use client'

import { useCallback, useEffect, useRef } from 'react'
import { withCeremonyFlow, withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { useQueryClient } from '@tanstack/react-query'
import type { Address, Hash, Hex, TransactionReceipt } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { buildRainWithdrawTypedData } from '@/utils/rainWithdraw.utils'
import { RainCooldownError, rainApi, type RainCollateralKind } from '@/services/rain'
import { peanutPublicClient } from '@/app/actions/clients'
import { tryMixedEphemeralSpend } from './mixedEphemeralSpend'
import { isRainControllerChanged, isSpendRecoveryOutcome } from './signSpendRetry'
import { isUserOpRevertedError } from '@/utils/userop-rescue.utils'
import { sleepUnlessCancelled } from '@/utils/cancellable-wait'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey } from './useGrantSessionKey'
import { useRainControllerRepair } from './useRainControllerRepair'
import { usdcUnitsToRainCents, isRainBalanceKnown } from '@/utils/balance.utils'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { isDemoMode } from '@/utils/demo'
import { debitDemoBalance } from '@/utils/demo-balance'
import { resolveSettledTxHash } from '@/utils/settled-tx-hash.utils'
import {
    ensureCurrentControllerApproval,
    ensurePreparedControllerApproval,
    isStaleGrantApproval,
    isUserCancellation,
    resolveSpendStrategy,
    runCollateralSpendPreflight,
    sameAddress,
    SessionKeyGrantRequiredError,
    type SpendStrategy,
} from './spendPreflight'

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
    /** When this spend pays a Peanut request/charge, the charge uuid. On the
     *  `collateral-only` strategy the backend uses the charge intent itself as
     *  the prep and completes it on confirm; a follow-up `recordPayment` is
     *  still safe — the backend routes it through the same trusted-completion
     *  path (idempotent), which doubles as the recovery net when /submit's
     *  post-mining bookkeeping fails. Ignored for `smart-only` and `mixed`,
     *  where `recordPayment` remains the charge-completion trigger — so
     *  charge-backed callers should ALWAYS record the payment afterwards
     *  (skipping it leaves the charge PENDING forever and the spend invisible
     *  in Activity). */
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

// Routing primitives + shared errors (InsufficientSpendableError,
// SessionKeyGrantRequiredError, computeSpendStrategy, fetchLiveSmartUsdcBalance)
// live in ./spendPreflight — shared verbatim with useSignSpendBundle.

// `usdcUnitsToRainCents` lives in @/utils/balance.utils alongside its sibling
// `rainCentsToUsdcUnits`. Rain's wire convention is asymmetric: cents (2dp)
// on INPUT to /prepare, USDC wei (PEANUT_WALLET_TOKEN_DECIMALS) on OUTPUT in
// the signed parameters (what the EIP-712 message + coordinator sign over).
// `usdcUnitsToRainCents` is for the input side only — never call it on amounts
// returned from Rain.

/** Ceiling for the ONE cooldown wait a controller recovery may take. */
const RECOVERY_COOLDOWN_CEILING_MS = 600_000
/** Kinds whose amount is locked to a provider quote that expires long before a
 *  Rain cooldown can clear. They must never be parked in a wait — the user has
 *  to see and confirm refreshed terms (see useSignSpendBundle callers). */
const PROVIDER_QUOTED_KINDS = new Set<RainCollateralKind>(['QR_PAY', 'FIAT_OFFRAMP', 'FIAT_ONRAMP'])

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
    const { getClientForChain, rebuildClientForChain, getPatchedSudoValidator } = useKernelClient()
    const { handleSendUserOpEncoded } = useZeroDev()
    const { user } = useAuth()
    const { overview, refetch: refetchOverview } = useRainCardOverview()
    const { grant } = useGrantSessionKey()
    const repairRainController = useRainControllerRepair()
    // Optional — overlay is UI polish, not correctness. If ModalsProvider
    // isn't mounted (isolated component tests, future Storybook stories,
    // etc.), the toggle silently no-ops instead of throwing and blocking
    // the actual spend. Production trees mount the provider via
    // contextProvider, so the overlay still renders end-to-end.
    const modals = useModalsContextOptional()
    const queryClient = useQueryClient()
    // Leaving the screen ends any in-flight recovery wait: nothing may be
    // signed or submitted for a flow the user has walked away from.
    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => {
            unmountedRef.current = true
        }
    }, [])

    const spendInner = useCallback(
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

            // demo mode: simulated success, no chain. Debit the persisted demo
            // balance so the displayed balance updates (and survives relaunch).
            if (isDemoMode()) {
                onStrategyDecided?.('smart-only')
                await new Promise((resolve) => setTimeout(resolve, 600))
                debitDemoBalance(requiredUsdcAmount)
                return { strategy: 'smart-only', userOpHash: `0x${'de'.repeat(32)}` as Hash, receipt: null }
            }

            const hasSubsequent = subsequentCalls.length > 0
            const collateralOnlyAllowed = !hasSubsequent && !!recipient

            const chainIdNum = PEANUT_WALLET_CHAIN.id
            const chainIdStr = chainIdNum.toString()

            // Route on the LIVE on-chain balance of the exact account that will
            // send the UserOp — never a cached value (see fetchLiveSmartUsdcBalance).
            // getClientForChain also asserts the client belongs to the logged-in
            // user, so this is the authoritative sender + balance pair.
            const kernelClient = getClientForChain(chainIdStr)
            const { strategy, smartBalance } = await resolveSpendStrategy({
                queryClient,
                accountAddress: kernelClient.account!.address,
                requiredUsdcAmount,
                rainSpendingPower,
                collateralOnlyAllowed,
                rainBalanceKnown: isRainBalanceKnown(overview),
            })

            onStrategyDecided?.(strategy)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, { strategy, kind })

            // Hoisted so the catch can back an abandoned draft out — `prep`
            // itself is block-scoped inside the try (TASK-21815). Once a
            // broadcast is ATTEMPTED, a throw is execution-ambiguous (the
            // response may be lost after money moved) — from that point the
            // catch must NOT cancel; the backend's TTL sweep (probe-verified)
            // owns cleanup.
            let livePreparationId: string | undefined
            let broadcastAttempted = false
            // Sticky: an attempt that crossed the broadcast boundary and then
            // failed WITHOUT a ceremony rejection of its own (the session-key
            // attempt falls through to the passkey path). Once set, NOTHING
            // may cancel this draft — not even a later ceremony rejection on
            // the fallback attempt: the earlier broadcast may have landed.
            let ambiguousBroadcast = false
            // The crossed-but-failed Rain attempt itself, retained ONLY so a
            // later user cancellation of the passkey fallback can't hide it
            // from the controller-cache repair below.
            let crossedRainFailure: Error | undefined
            // Recovery bookkeeping for the mixed leg: a fresh preparation is
            // only safe while every broadcast this leg made is proven reverted.
            let broadcastsAttempted = 0
            let broadcastsProvenReverted = 0
            let preparedCoordinator: string | undefined
            let mixedRecovered = false
            // Set only while an internal controller recovery re-prepares, so the
            // 425 it may hit is handled here instead of popping the global
            // cooldown explainer for an attempt the user never made.
            let recoveringController = false
            /** The failure that authorised the replacement. Rethrown verbatim if
             *  the user leaves mid-replacement, so its classification stands. */
            let recoveryTrigger: unknown

            /**
             * Checkpoint for the REPLACEMENT leg only: every step of it can
             * resolve after the user left, and none of them may lead to another
             * prompt or send. A leg already sent keeps its own reconciliation —
             * this only stops work that has not gone out.
             */
            const abortReplacementIfGone = () => {
                if ((recoveringController || mixedRecovered) && unmountedRef.current) throw recoveryTrigger
            }

            /** True only when the server's controller really differs from the
             *  one THIS payment prepared against. Never inferred from an error. */
            const controllerMovedSincePrepare = async (): Promise<boolean> => {
                if (!preparedCoordinator) return false
                const current = await rainApi.refreshControllerAddress().catch(() => null)
                if (unmountedRef.current) return false
                return !!current && current.coordinatorAddress.toLowerCase() !== preparedCoordinator.toLowerCase()
            }

            /**
             * Runs a recovery leg, absorbing ONE Rain cooldown: wait out the
             * backend's own `retryAfterSec` (bounded, cancellable) and prepare
             * again. Nothing is broadcast while waiting, and a provider-quoted
             * spend never waits — its quote would expire first.
             */
            const runWithCooldownRetry = async (run: () => Promise<SpendBundleResult>): Promise<SpendBundleResult> => {
                try {
                    return await run()
                } catch (err) {
                    if (!(err instanceof RainCooldownError) || PROVIDER_QUOTED_KINDS.has(kind)) throw err
                    const retryAfterSec = err.retryAfterSec
                    if (!retryAfterSec || retryAfterSec * 1000 > RECOVERY_COOLDOWN_CEILING_MS) throw err
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, {
                        strategy,
                        kind,
                        recovery: 'cooldown-wait',
                        retry_after_sec: retryAfterSec,
                    })
                    // +1s so the retry lands after the backend's own window.
                    const proceed = await sleepUnlessCancelled(retryAfterSec * 1000 + 1_000, () => unmountedRef.current)
                    if (!proceed) throw err
                    return await run()
                }
            }
            try {
                // Controller + approval check before anything is prepared or
                // signed. Once per spend: the replacement legs below read the
                // controller through their own recovery.
                const gate = await ensureCurrentControllerApproval({
                    strategy,
                    overview,
                    refreshController: () => rainApi.refreshControllerAddress(),
                    // react-query's refetch resolves with an error STATE (and the
                    // stale data) on failure; the gate must fail closed on it.
                    refetchOverview: async () => {
                        const result = await refetchOverview()
                        if (result.isError) throw result.error
                        return result.data
                    },
                    grant,
                    onGrantRequired,
                    isGone: () => unmountedRef.current,
                })

                // Shared collateral pre-flights (root-validator migration gate)
                // — ONE ordered sequence for both spend engines; see
                // runCollateralSpendPreflight. Every signature below MUST come
                // from the client it returns. A grant above can migrate +
                // rebuild the kernel client (the cache is ref-backed), so the
                // gate is fed the re-read client when one ran. The per-prep
                // approval check runs after /prepare (ensurePreparedControllerApproval).
                const activeClient = await runCollateralSpendPreflight({
                    strategy,
                    kind,
                    kernelClient: gate.granted ? getClientForChain(chainIdStr) : kernelClient,
                    overview: gate.overview,
                    requireOverview: false,
                    sendNoopUserOp: (call) =>
                        handleSendUserOpEncoded([call], chainIdStr, { returnRevertedReceipt: true }),
                    rebuildClient: () => rebuildClientForChain(chainIdStr),
                    setSecurityOverlay: modals?.setIsSecurityVerificationOpen,
                    migrationTrigger: 'mixed-spend',
                })

                // ─── collateral-only ──────────────────────────────────────────────
                if (strategy === 'collateral-only') {
                    const runCollateralWithdrawal = async (): Promise<SpendBundleResult> => {
                        // The backend chooses the intent kind from the destination
                        // (TASK-21815) — nothing user-declared goes on the wire.
                        const prep = await rainApi.prepareWithdrawal(
                            {
                                amount: usdcUnitsToRainCents(requiredUsdcAmount).toString(),
                                recipientAddress: recipient!,
                                directTransfer: true,
                                // When set, the backend uses the charge as the prep and
                                // completes it directly on confirm; a follow-up
                                // recordPayment re-enters the same trusted-completion
                                // path idempotently (see SpendBundleInput.chargeId).
                                chargeId,
                            },
                            { suppressCooldownEvent: recoveringController }
                        )
                        abortReplacementIfGone()
                        // A charge-backed prep IS the charge — never back it out
                        // through the draft-cancel door.
                        if (!chargeId) livePreparationId = prep.preparationId
                        preparedCoordinator = prep.coordinatorAddress

                        // The prep states the coordinator this withdrawal targets;
                        // make sure the stored approval covers THAT one before signing.
                        // Already proven by the pre-prepare gate when the prep
                        // names the controller it just checked; any other
                        // coordinator (moved since) runs the full check.
                        const { granted } = sameAddress(prep.coordinatorAddress, gate.approvedCoordinator)
                            ? { granted: false }
                            : await ensurePreparedControllerApproval({
                                  preparedCoordinator: prep.coordinatorAddress,
                                  overview: gate.overview,
                                  refetchOverview: async () => (await refetchOverview()).data,
                                  grant,
                                  onGrantRequired,
                              })
                        abortReplacementIfGone()
                        // The grant can migrate + rebuild the kernel client; the
                        // cache is ref-backed, so re-read it before signing.
                        const signingClient = granted ? getClientForChain(chainIdStr) : activeClient

                        const adminSignature = (await withCeremonyPurpose('admin_eip712', () =>
                            signingClient.account!.signTypedData(buildRainWithdrawTypedData(prep, chainIdNum))
                        )) as Hex
                        abortReplacementIfGone()

                        broadcastAttempted = true
                        const { txHash } = await rainApi.submitWithdrawal({
                            // Hint only — the server never targets this address.
                            preparedCoordinatorAddress: prep.coordinatorAddress,
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

                    try {
                        return await runCollateralWithdrawal()
                    } catch (e) {
                        // RAIN_CONTROLLER_CHANGED is the backend's proof that
                        // this attempt had NO financial effect — refused before
                        // any order/claim/broadcast, or (direct endpoint only)
                        // after a proven no-effect late failure: a final DB
                        // mismatch before send, or an inner userOp receipt that
                        // strictly reported success === false, with the
                        // controller actually changed. So the same payment can be
                        // re-prepared against the controller it just recorded.
                        // Exactly one retry; any other failure (including a
                        // generic transport error) propagates.
                        //
                        // A user who has left takes no further side effects: the
                        // failure above keeps its own meaning and reconciliation.
                        /*
                         * The rotation can also surface one step earlier, while
                         * the inline grant is SAVED: `/session-approve` refuses
                         * the approval we just signed (400 STALE_CARD_APPROVAL)
                         * because another request already moved the record. That
                         * is a rotation CANDIDATE, not proof — confirm it against
                         * the controller this payment prepared against before
                         * re-preparing. Nothing has been signed for the wire or
                         * sent at that point.
                         */
                        const staleGrant = isStaleGrantApproval(e) && !recoveringController && !unmountedRef.current
                        const rotationConfirmed = staleGrant && (await controllerMovedSincePrepare())
                        if ((!isRainControllerChanged(e) && !rotationConfirmed) || unmountedRef.current) throw e
                        recoveryTrigger = e
                        posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, {
                            strategy,
                            kind,
                            recovery: rotationConfirmed ? 'controller-changed-on-grant' : 'controller-changed',
                        })
                        // A refused grant leaves the standalone draft pending.
                        // Preserve its best-effort cleanup; charge-backed IDs
                        // never enter livePreparationId. This does not unlock Rain.
                        if (rotationConfirmed && livePreparationId) {
                            void rainApi.cancelPreparation(livePreparationId)
                        }
                        // Verify failures already failed their preparation.
                        livePreparationId = undefined
                        broadcastAttempted = false
                        recoveringController = true
                        return await runWithCooldownRetry(runCollateralWithdrawal)
                    }
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

                const runMixedSpend = async (): Promise<SpendBundleResult> => {
                    const shortfall = requiredUsdcAmount - smartBalance
                    const prep = await rainApi.prepareWithdrawal(
                        {
                            amount: usdcUnitsToRainCents(shortfall).toString(),
                            // directTransfer=false sends tokens to the admin (kernel). We still pass
                            // the admin address here; the backend + coordinator treat it as the
                            // withdraw beneficiary, which equals msg.sender-to-be in the follow-up UserOp.
                            recipientAddress: adminAddress,
                            directTransfer: false,
                            // History shows the full user-initiated spend, not just the
                            // shortfall Rain signed over.
                            totalAmountCents: usdcUnitsToRainCents(requiredUsdcAmount).toString(),
                        },
                        { suppressCooldownEvent: recoveringController }
                    )
                    livePreparationId = prep.preparationId
                    preparedCoordinator = prep.coordinatorAddress
                    abortReplacementIfGone()

                    /*
                     * One tap: a per-transaction ephemeral key signs both the admin
                     * EIP-712 and the UserOp after a single enable-signature tap.
                     * Falls through to the two-tap passkey path on any failure —
                     * safe even for ambiguous post-broadcast errors because both
                     * attempts reuse THIS prep, and the coordinator's adminNonce
                     * lets only one of them execute (the loser's batch reverts
                     * atomically). See mixedEphemeralSpend.ts.
                     */
                    {
                        abortReplacementIfGone()
                        posthog.capture(ANALYTICS_EVENTS.SESSION_KEY_SPEND_ATTEMPTED, { kind })
                        modals?.setIsSecurityVerificationOpen?.(true)
                        let attempt: Awaited<ReturnType<typeof tryMixedEphemeralSpend>>
                        let ephemeralCrossed = false
                        try {
                            // Resolving the sudo validator is outside the helper's own
                            // catch: a rejection here must still take the passkey path,
                            // not escape as a failed spend after /prepare already ran.
                            const patchedSudoValidator = await getPatchedSudoValidator(peanutPublicClient)
                            attempt = await tryMixedEphemeralSpend({
                                onBroadcastAttempt: () => {
                                    broadcastAttempted = true
                                    ephemeralCrossed = true
                                    broadcastsAttempted += 1
                                },
                                publicClient: peanutPublicClient,
                                chain: PEANUT_WALLET_CHAIN,
                                patchedSudoValidator,
                                accountAddress: activeClient.account!.address,
                                prep,
                                recipient,
                                requiredUsdcAmount,
                                subsequentCalls,
                            })
                        } catch (e) {
                            attempt = { ok: false, reason: e instanceof Error ? e.message : String(e) }
                        } finally {
                            modals?.setIsSecurityVerificationOpen?.(false)
                        }
                        // A crossed-but-failed session-key attempt is ambiguous
                        // forever — the fallback passkey attempt reuses the SAME
                        // prep (only one can execute on-chain), so the draft must
                        // never be cancelled after this point.
                        if (!attempt.ok && ephemeralCrossed) {
                            ambiguousBroadcast = true
                            crossedRainFailure = new Error(attempt.reason)
                            // Only a receipt that reported success === false proves
                            // this broadcast moved nothing.
                            if (attempt.revertConfirmed) broadcastsProvenReverted += 1
                        }
                        if (attempt.ok) {
                            /*
                             * Stamp only a real transaction hash. With the receipt
                             * unresolved (bundler timeout, rescue miss) the op is still
                             * in flight: report it as submitted like the passkey path
                             * does, leave the intent PENDING for webhook reconciliation,
                             * and never hand the userOp hash to /stamp as a tx hash.
                             */
                            const mixedTxHash = attempt.receipt?.transactionHash
                            if (mixedTxHash) {
                                rainApi
                                    .stampWithdrawal({ preparationId: prep.preparationId, txHash: mixedTxHash })
                                    .catch(() => {})
                            }
                            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, {
                                strategy,
                                kind,
                                engine: 'session-key',
                                receipt: mixedTxHash ? 'settled' : 'unresolved',
                            })
                            return {
                                strategy,
                                userOpHash: attempt.userOpHash,
                                receipt: attempt.receipt,
                                intentId: prep.preparationId,
                            }
                        }
                        posthog.capture(ANALYTICS_EVENTS.SESSION_KEY_SPEND_FALLBACK, {
                            kind,
                            reason: attempt.reason.slice(0, 200),
                        })
                    }

                    abortReplacementIfGone()
                    const adminSignature = (await withCeremonyPurpose('admin_eip712', () =>
                        activeClient.account!.signTypedData(buildRainWithdrawTypedData(prep, chainIdNum))
                    )) as Hex
                    abortReplacementIfGone()

                    // Mixed = two passkey taps. The admin EIP-712 sig (tap #1) just
                    // resolved; the kernel now prepares the follow-up UserOp which
                    // will trigger tap #2. The gap is short but visible — show the
                    // security-verification overlay so the user has something to
                    // look at and the UI feels intentional rather than frozen.
                    // try/finally guarantees the overlay closes on success AND on
                    // bundler / kernel failure.
                    modals?.setIsSecurityVerificationOpen?.(true, 'next-passkey')
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
                        const { userOpHash, receipt } = await handleSendUserOpEncoded(calls, chainIdStr, {
                            onBroadcastAttempt: () => {
                                broadcastAttempted = true
                                broadcastsAttempted += 1
                            },
                        })

                        // Stamp the intent so the Rain collateral webhook reconciles to the
                        // right category (P2P_SEND, CRYPTO_WITHDRAW, etc). Non-blocking —
                        // a stamp failure leaves the intent PENDING, which only affects
                        // history labeling, not the spend itself.
                        const mixedTxHash = resolveSettledTxHash({ receipt, userOpHash }, 'spend-bundle-stamp')
                            .hash as Hex
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
                }

                try {
                    return await runMixedSpend()
                } catch (e) {
                    // One bounded re-run of the WHOLE leg (fresh prepare, fresh
                    // signatures, same recipient/amount/subsequentCalls), and only
                    // when nothing is left in doubt:
                    //  - every broadcast this leg attempted is PROVEN reverted by a
                    //    receipt (or none was attempted and the failure is not a
                    //    ceremony cancellation), and
                    //  - the controller really moved away from the one we prepared
                    //    against, read now.
                    // A fresh preparation changes replay safety, so an earlier
                    // ambiguous broadcast disqualifies the whole leg forever — a
                    // later confirmed revert never rehabilitates it.
                    const ceremonyRejected = isUserCancellation(e)
                    if (isUserOpRevertedError(e)) broadcastsProvenReverted += 1
                    const allSettled = broadcastsProvenReverted === broadcastsAttempted
                    // `unmountedRef`: the user left, so nothing new is prepared
                    // or signed. Anything already sent keeps its reconciliation.
                    if (mixedRecovered || ceremonyRejected || !allSettled || unmountedRef.current) throw e

                    // The backend's own rotation code — from prepare, from
                    // verify, or from the direct endpoint after a proven
                    // no-effect late failure — is proof on its own: it can
                    // arrive before this leg ever had a prepared coordinator to
                    // compare against.
                    if (!isRainControllerChanged(e) && !(await controllerMovedSincePrepare())) throw e
                    // The controller read above is awaited — re-check before the
                    // replacement prepare it authorises.
                    if (unmountedRef.current) throw e

                    mixedRecovered = true
                    recoveryTrigger = e
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, {
                        strategy,
                        kind,
                        recovery: 'controller-changed',
                    })
                    // The superseded prep is left to the backend's TTL sweep: its
                    // signature can still execute, so a cancel is refused, and
                    // cancelling never touches Rain's own signature state.
                    livePreparationId = undefined
                    broadcastAttempted = false
                    ambiguousBroadcast = false
                    crossedRainFailure = undefined
                    broadcastsAttempted = 0
                    broadcastsProvenReverted = 0
                    recoveringController = true
                    return await runWithCooldownRetry(runMixedSpend)
                }
            } catch (e) {
                // Typed control flow from the pre-prepare controller gate (a
                // dismissed re-sign prompt, or the screen left before anything
                // was prepared): nothing was prepared, signed or sent, so there
                // is no draft to back out, no cache to repair and no failed
                // payment to report.
                if (isSpendRecoveryOutcome(e)) throw e
                // Back the abandoned draft out ONLY when the failure provably
                // precedes any broadcast: either the broadcast boundary was
                // never reached (grant/setup/first-ceremony failure), or the
                // user dismissed a prompt — an unsigned op cannot have been
                // submitted, so a dismissed tap #2 inside the broadcast call is
                // still pre-broadcast. Anything else is execution-ambiguous
                // (money may have moved with the response lost) and relies on
                // the backend's probe-verified TTL sweep (TASK-21815 review).
                // `ambiguousBroadcast` still vetoes the cancel regardless.
                const ceremonyRejection = isUserCancellation(e)
                if (livePreparationId && !ambiguousBroadcast && (!broadcastAttempted || ceremonyRejection)) {
                    void rainApi.cancelPreparation(livePreparationId)
                }
                // This engine broadcasts the mixed UserOp itself, so the backend
                // never sees the failure. Judge repair on the earlier crossed
                // Rain attempt when there was one — the final error may be a
                // cancellation of the fallback. Cache-only, nothing re-sent.
                void repairRainController({ strategy, error: crossedRainFailure ?? e })
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
        [
            getClientForChain,
            rebuildClientForChain,
            getPatchedSudoValidator,
            handleSendUserOpEncoded,
            user,
            overview,
            refetchOverview,
            grant,
            repairRainController,
            modals,
            queryClient,
        ]
    )

    // Brackets every ceremony one spend triggers as a flow (spend:<kind>) so
    // the prompt count per kind is measurable; link_create nests inside it.
    const spend = useCallback(
        (input: SpendBundleInput) => {
            let strategy: string | undefined
            return withCeremonyFlow(
                `spend:${input.kind}`,
                () =>
                    spendInner({
                        ...input,
                        onStrategyDecided: (decided) => {
                            strategy = decided
                            input.onStrategyDecided?.(decided)
                        },
                    }),
                () => ({ strategy })
            )
        },
        [spendInner]
    )

    return { spend }
}
