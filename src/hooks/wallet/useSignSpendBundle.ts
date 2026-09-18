'use client'

import { useCallback, useEffect, useRef } from 'react'
import { withCeremonyFlow, withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { useQueryClient } from '@tanstack/react-query'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { peanutPublicClient } from '@/app/actions/clients'
import { sessionKeySignEnabled } from '@/constants/session-key-sign.consts'
import { signMixedEphemeralSpend, type MixedEphemeralSignResult } from './mixedEphemeralSign'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { buildRainWithdrawTypedData } from '@/utils/rainWithdraw.utils'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { RainCooldownError, rainApi, type RainCollateralKind } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey } from './useGrantSessionKey'
import { useRainControllerRepair } from './useRainControllerRepair'
import { useSignUserOp, type SignedUserOpData } from './useSignUserOp'
import {
    ensurePreparedControllerApproval,
    InsufficientSpendableError,
    resolveSpendStrategy,
    runCollateralSpendPreflight,
    type SpendStrategy,
} from './spendPreflight'
import {
    isRainControllerChanged,
    isSpendRecoveryOutcome,
    registerEphemeralArtifact,
    registerSpendArtifactMeta,
    requiresPasskeyRetry,
    SpendRecoveryAbortedError,
    SpendRecoveryQuoteReviewError,
} from './signSpendRetry'
import { isUserCancellation } from './useSignedSpendRecovery'
import { sleepUnlessCancelled } from '@/utils/cancellable-wait'
import { usdcUnitsToRainCents } from '@/utils/balance.utils'

/**
 * Wire payload for a Rain withdrawal that the backend will broadcast (via
 * session-key UserOp) AFTER its precondition succeeds (e.g. Manteca order
 * created). Mirrors `/rain/cards/withdraw/submit`'s body.
 */
export interface SignedRainWithdrawal {
    /** Classification hint — see `SubmitRainWithdrawalInput`. Never a target. */
    preparedCoordinatorAddress?: string
    preparationId: string
    amount: string
    recipientAddress: Address
    directTransfer: boolean
    adminSalt: Hex
    adminNonce: string
    adminSignature: Hex
    executorSignature: string
    executorSalt: string
    expiresAt: number
}

export type SignedSpendArtifact =
    | {
          strategy: 'smart-only'
          /** Single-transfer USDC UserOp from the smart account. Backend broadcasts. */
          signedUserOp: SignedUserOpData
      }
    | {
          strategy: 'mixed'
          /** Batch UserOp `[withdrawAsset, transfer]` from the smart account. Backend broadcasts. */
          signedUserOp: SignedUserOpData
          /** TransactionIntent id created by `/rain/cards/withdraw/prepare`.
           *  Backend echoes / stamps this so the Rain webhook reconciles correctly. */
          rainPreparationId: string
      }
    | {
          strategy: 'collateral-only'
          /** Backend submits this directly via the user's session-key UserOp on the
           *  Rain coordinator (`directTransfer=true` straight to the recipient). */
          rainWithdrawal: SignedRainWithdrawal
      }

export interface SignSpendBundleInput {
    /** Total USDC (token smallest units) the spend must deliver. */
    requiredUsdcAmount: bigint
    /** Final recipient — required (Manteca-style flows always have a fixed destination). */
    recipient: Address
    /** Rain collateral `spendingPower` right now, in token smallest units. */
    rainSpendingPower: bigint
    /** User-semantic category of this spend (QR_PAY, FIAT_OFFRAMP, …).
     *  Persisted on the `TransactionIntent` the backend creates in /prepare. */
    kind: RainCollateralKind
    /** Skip live-balance routing and force this strategy. For flows whose
     *  PURPOSE is moving collateral itself (e.g. returning excess to the
     *  wallet after a limit decrease) — routing would pick smart-only
     *  whenever the smart account covers the amount, a self-transfer no-op.
     *  Affordability is still enforced against `rainSpendingPower`. */
    forceStrategy?: 'collateral-only'
    /** Fires once routing is picked, before any signing. */
    onStrategyDecided?: (strategy: Exclude<SpendStrategy, 'insufficient'>) => void
    /** Fires right before the one-time session-key grant prompt appears. */
    onGrantRequired?: () => void
    /** Set by an internal controller recovery re-sign: a 425 on ITS prepare is
     *  handled by the recovery (wait or quote review), so the global cooldown
     *  explainer must not fire for an attempt the user never made. */
    suppressCooldownEvent?: boolean
    /** Epoch ms this payment's provider quote dies at. Lets an internal
     *  recovery wait out a Rain cooldown when it still fits, instead of
     *  handing back to quote review. */
    lockExpiresAt?: number
}

/**
 * Sign-only sibling of `useSpendBundle`. Picks a strategy
 * (collateral-only / smart-only / mixed) and returns the signed artifacts
 * WITHOUT broadcasting. Designed for Manteca's sign-then-broadcast pattern,
 * where the backend gates the broadcast on creating the Manteca order first.
 *
 * Strategies map to backend behaviour:
 * - smart-only: backend broadcasts the signed UserOp via the bundler.
 * - mixed: backend broadcasts the signed UserOp (which atomically pulls
 *   collateral — up to and including the FULL amount — and forwards it to the
 *   recipient). Ordinary collateral funding runs here: it is the pipeline with
 *   a durable reservation, a precomputed hash, broadcast-first submission and
 *   definitive failure codes, so a late controller rotation can be replaced on
 *   the same lock. Cost: the passkey fallback is two taps instead of the direct
 *   path's one (the ephemeral one-tap path is unchanged where enabled).
 * - collateral-only: ONLY for `forceStrategy` callers (lock/cancel card).
 *   Backend submits the signed Rain withdrawal via the user's session-key
 *   UserOp with `directTransfer=true` (1 passkey tap — admin EIP-712 only);
 *   that handler orders before funding and has no safe resume.
 */

/** Headroom the replacement still needs to sign + reach the backend. */
const RESIGN_MARGIN_MS = 20_000

export const useSignSpendBundle = () => {
    const { getClientForChain, rebuildClientForChain, getPatchedSudoValidator } = useKernelClient()
    const { handleSendUserOpEncoded } = useZeroDev()
    const modals = useModalsContextOptional()
    const { signCallsUserOp } = useSignUserOp()
    const { overview, refetch: refetchOverview } = useRainCardOverview()
    const { grant } = useGrantSessionKey()
    const repairRainController = useRainControllerRepair()
    const queryClient = useQueryClient()
    // Leaving the screen ends an in-flight recovery wait: nothing may be
    // prepared, signed or submitted for a flow the user walked away from.
    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => {
            unmountedRef.current = true
        }
    }, [])

    const signSpendInner = useCallback(
        async (input: SignSpendBundleInput): Promise<SignedSpendArtifact> => {
            const {
                requiredUsdcAmount,
                recipient,
                rainSpendingPower,
                kind,
                forceStrategy,
                onStrategyDecided,
                onGrantRequired,
                suppressCooldownEvent,
                lockExpiresAt,
            } = input

            const chainIdNum = PEANUT_WALLET_CHAIN.id
            const chainIdStr = chainIdNum.toString()

            // Resolve the kernel account once for all strategies. The non-null
            // assertion on `client.account` was crash-prone if auth was still
            // hydrating; do the guard once and reuse `account.address` as the
            // canonical admin address (rather than re-deriving from useAuth).
            const kernelClient = getClientForChain(chainIdStr)
            const kernelAccount = kernelClient.account
            if (!kernelAccount) {
                throw new Error('useSignSpendBundle: kernel account not initialized')
            }

            // Route on the LIVE on-chain balance of the exact account that will
            // send the UserOp — never a cached value (see fetchLiveSmartUsdcBalance).
            // A stale, pre-sweep balance routes `smart-only` to an empty account
            // and reverts on-chain (incident #2230).
            // Manteca-style flows always have a single recipient and no
            // subsequent kernel calls — collateral-only is always eligible.
            let strategy: Exclude<SpendStrategy, 'insufficient'>
            let smartBalance = 0n
            if (forceStrategy === 'collateral-only') {
                // Forced path: the caller is deliberately draining collateral, so
                // only the collateral bucket can fund it. Same insufficient
                // handling as resolveSpendStrategy (funnel capture, refresh,
                // fail closed).
                if (rainSpendingPower < requiredUsdcAmount) {
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
                        strategy: 'insufficient',
                        error_kind: 'insufficient',
                        flow: 'sign-only',
                    })
                    queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
                    throw new InsufficientSpendableError()
                }
                strategy = 'collateral-only'
            } else {
                ;({ strategy, smartBalance } = await resolveSpendStrategy({
                    queryClient,
                    accountAddress: kernelAccount.address,
                    requiredUsdcAmount,
                    rainSpendingPower,
                    collateralOnlyAllowed: true,
                    flow: 'sign-only',
                }))
                /*
                 * Ordinary collateral funding EXECUTES through the mixed
                 * pipeline: it is the one with a durable reservation, a
                 * precomputed hash, broadcast-first and definitive failure
                 * codes, so a late controller rotation can be recovered on the
                 * same lock. The legacy collateral handler creates the provider
                 * order before funding and cannot be resumed safely.
                 *
                 * `smartBalance = 0` (not `collateralOnlyAllowed: false`) keeps
                 * the funding SOURCE the user's routing already chose: the whole
                 * amount comes from collateral even when the smart account has a
                 * balance. Forced collateral-only (lock/cancel card) is exempt —
                 * it is submitted by the backend's session key, not broadcast.
                 */
                if (strategy === 'collateral-only') {
                    strategy = 'mixed'
                    smartBalance = 0n
                }
            }

            onStrategyDecided?.(strategy)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, { strategy, kind, flow: 'sign-only' })

            // Failure-capture parity with useSpendBundle's catch: without this,
            // a failed migration/grant/signing in the sign-then-broadcast flow
            // emits `attempted` with no terminal event and the funnel lies.
            // Hoisted so the catch can back the draft out — `prep` itself is
            // block-scoped inside the try.
            let livePreparationId: string | undefined
            // Tracked at PREPARE time: a rotation can break this attempt before
            // any artifact (and its metadata) exists.
            let preparedCoordinator: string | undefined
            let signRecovered = false
            /** The failure that authorised the replacement, carried as the
             *  abort's cause so the call site still knows what happened. */
            let recoveryTrigger: unknown

            /**
             * Checkpoint for the REPLACEMENT attempt only: its prepare, grant and
             * signature can each resolve after the user left, and none of them
             * may lead to another prompt or a returned artifact the caller would
             * submit. Nothing already sent is touched — this engine sends nothing.
             */
            const abortReplacementIfGone = () => {
                if (signRecovered && unmountedRef.current) throw new SpendRecoveryAbortedError(recoveryTrigger)
            }

            const runSignAttempt = async (): Promise<SignedSpendArtifact> => {
                // Shared collateral pre-flights (root-validator migration gate) —
                // ONE ordered sequence for both spend engines; see
                // runCollateralSpendPreflight. Every signature below MUST come
                // from the account it returns. requireOverview: this engine can't
                // tell whether the grant exists while the overview is loading, and
                // signing optimistically would crash on the backend submission.
                // The session-key grant runs after /prepare, which is what knows
                // the coordinator the approval has to cover.
                const activeClient = await runCollateralSpendPreflight({
                    strategy,
                    kind,
                    kernelClient,
                    overview,
                    requireOverview: true,
                    sendNoopUserOp: (call) =>
                        handleSendUserOpEncoded([call], chainIdStr, { returnRevertedReceipt: true }),
                    rebuildClient: () => rebuildClientForChain(chainIdStr),
                    setSecurityOverlay: modals?.setIsSecurityVerificationOpen,
                    migrationTrigger: 'sign-spend',
                })
                const activeAccount = activeClient.account
                if (!activeAccount) {
                    throw new Error('useSignSpendBundle: kernel account not initialized after preflight')
                }

                // ─── smart-only ─────────────────────────────────────────────────
                if (strategy === 'smart-only') {
                    const transferData = encodeFunctionData({
                        abi: erc20Abi,
                        functionName: 'transfer',
                        args: [recipient, requiredUsdcAmount],
                    })
                    const signedUserOp = await signCallsUserOp(
                        [{ to: PEANUT_WALLET_TOKEN as Hex, value: 0n, data: transferData }],
                        chainIdStr
                    )
                    return { strategy, signedUserOp }
                }

                // ─── collateral-only ────────────────────────────────────────────
                // Only sign the admin EIP-712 — backend submits the withdrawal via
                // the user's session-key UserOp (1 tap total).
                if (strategy === 'collateral-only') {
                    // The backend chooses the intent kind from the destination
                    // (TASK-21815) — nothing user-declared goes on the wire.
                    const prep = await rainApi.prepareWithdrawal(
                        {
                            amount: usdcUnitsToRainCents(requiredUsdcAmount).toString(),
                            recipientAddress: recipient,
                            directTransfer: true,
                        },
                        { suppressCooldownEvent: suppressCooldownEvent === true || signRecovered }
                    )
                    livePreparationId = prep.preparationId
                    preparedCoordinator = prep.coordinatorAddress
                    abortReplacementIfGone()

                    // The prep states the coordinator this withdrawal targets;
                    // make sure the stored approval covers THAT one before signing.
                    const { granted } = await ensurePreparedControllerApproval({
                        preparedCoordinator: prep.coordinatorAddress,
                        overview,
                        refetchOverview: async () => (await refetchOverview()).data,
                        grant,
                        onGrantRequired,
                    })
                    // The grant can migrate + rebuild the kernel client; the
                    // cache is ref-backed, so re-read it before signing.
                    abortReplacementIfGone()
                    const signingAccount = granted
                        ? (getClientForChain(chainIdStr).account ?? activeAccount)
                        : activeAccount

                    const adminSignature = (await withCeremonyPurpose('admin_eip712', () =>
                        signingAccount.signTypedData(buildRainWithdrawTypedData(prep, chainIdNum))
                    )) as Hex
                    abortReplacementIfGone()

                    return registerSpendArtifactMeta(
                        {
                            strategy,
                            rainWithdrawal: {
                                preparedCoordinatorAddress: prep.coordinatorAddress,
                                preparationId: prep.preparationId,
                                amount: prep.amount,
                                recipientAddress: prep.recipientAddress as Address,
                                directTransfer: prep.directTransfer,
                                adminSalt: prep.adminSalt as Hex,
                                adminNonce: prep.adminNonce,
                                adminSignature,
                                executorSignature: prep.executorSignature,
                                executorSalt: prep.executorSalt,
                                expiresAt: prep.expiresAt,
                            },
                        },
                        { coordinatorAddress: prep.coordinatorAddress }
                    )
                }

                // ─── mixed ──────────────────────────────────────────────────────
                // Pull the shortfall from collateral into the smart account, then
                // forward the full amount to the recipient — one atomic UserOp,
                // signed without broadcasting. Two passkey taps (admin sig + UserOp).
                // Use the kernel account's own address as the admin recipient (the
                // address we sign FROM) instead of re-deriving from useAuth.
                const adminAddress = kernelAccount.address as Address

                const shortfall = requiredUsdcAmount - smartBalance
                const prep = await rainApi.prepareWithdrawal(
                    {
                        amount: usdcUnitsToRainCents(shortfall).toString(),
                        // directTransfer=false sends tokens to the admin (kernel). Same
                        // semantics as broadcasting useSpendBundle.spend's mixed path.
                        recipientAddress: adminAddress,
                        directTransfer: false,
                        totalAmountCents: usdcUnitsToRainCents(requiredUsdcAmount).toString(),
                    },
                    { suppressCooldownEvent: suppressCooldownEvent === true || signRecovered }
                )
                livePreparationId = prep.preparationId
                preparedCoordinator = prep.coordinatorAddress
                abortReplacementIfGone()

                /*
                 * SESSION_KEY_SIGN: one tap instead of two — see mixedEphemeralSign.ts.
                 * Falls through to the two-tap path on any failure; nothing has
                 * been broadcast, so the same prep is reused with nothing at stake.
                 */
                if (sessionKeySignEnabled(prep.mixedSpendContract) && !requiresPasskeyRetry(adminAddress)) {
                    posthog.capture(ANALYTICS_EVENTS.SESSION_KEY_SPEND_ATTEMPTED, { kind, flow: 'sign-only' })
                    modals?.setIsSecurityVerificationOpen?.(true)
                    let attempt: MixedEphemeralSignResult
                    try {
                        // Resolving the sudo validator is outside the helper's own
                        // catch: a rejection here must still take the passkey path.
                        const patchedSudoValidator = await getPatchedSudoValidator(peanutPublicClient)
                        attempt = await signMixedEphemeralSpend({
                            publicClient: peanutPublicClient,
                            chain: PEANUT_WALLET_CHAIN,
                            patchedSudoValidator,
                            accountAddress: activeAccount.address as Hex,
                            prep,
                            recipient: recipient as Hex,
                            requiredUsdcAmount,
                        })
                    } catch (e) {
                        attempt = { ok: false, reason: e instanceof Error ? e.message : String(e) }
                    } finally {
                        modals?.setIsSecurityVerificationOpen?.(false)
                    }
                    if (attempt.ok) {
                        return registerSpendArtifactMeta(
                            registerEphemeralArtifact(
                                {
                                    strategy,
                                    signedUserOp: attempt.signedUserOp,
                                    rainPreparationId: prep.preparationId,
                                },
                                adminAddress
                            ),
                            {
                                coordinatorAddress: prep.coordinatorAddress,
                                mixedSpendContract: prep.mixedSpendContract,
                            }
                        )
                    }
                    posthog.capture(ANALYTICS_EVENTS.SESSION_KEY_SPEND_FALLBACK, {
                        kind,
                        flow: 'sign-only',
                        reason: attempt.reason.slice(0, 200),
                    })
                }

                abortReplacementIfGone()
                const adminSignature = (await withCeremonyPurpose('admin_eip712', () =>
                    activeAccount.signTypedData(buildRainWithdrawTypedData(prep, chainIdNum))
                )) as Hex
                abortReplacementIfGone()

                const withdrawCall = {
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

                const transferCall = {
                    to: PEANUT_WALLET_TOKEN as Hex,
                    value: 0n,
                    data: encodeFunctionData({
                        abi: erc20Abi,
                        functionName: 'transfer',
                        args: [recipient, requiredUsdcAmount],
                    }),
                }

                // Tap #2 follows the admin signature; tell the user so the second
                // sheet is not dismissed as a duplicate (same beat as useSpendBundle).
                modals?.setIsSecurityVerificationOpen?.(true, 'next-passkey')
                let signedUserOp: SignedUserOpData
                try {
                    signedUserOp = await signCallsUserOp([withdrawCall, transferCall], chainIdStr)
                } finally {
                    modals?.setIsSecurityVerificationOpen?.(false)
                }
                return registerSpendArtifactMeta(
                    { strategy, signedUserOp, rainPreparationId: prep.preparationId },
                    { coordinatorAddress: prep.coordinatorAddress, mixedSpendContract: prep.mixedSpendContract }
                )
            }

            const controllerMovedSincePrepare = async (): Promise<boolean> => {
                if (!preparedCoordinator) return false
                const current = await rainApi.refreshControllerAddress().catch(() => null)
                return !!current && current.coordinatorAddress.toLowerCase() !== preparedCoordinator.toLowerCase()
            }

            try {
                return await runSignAttempt()
            } catch (e) {
                /*
                 * Nothing here has broadcast anything — this engine only signs
                 * (the migration no-op and the grant are the sole userOps) — so a
                 * rotation that killed the prepare/estimate can be re-run once
                 * with the SAME terms before the user ever sees a failure. A
                 * dismissed prompt is the user's answer, never a retry.
                 */
                const userCancelled = isUserCancellation(e)
                // Leaving the screen ends the recovery at every boundary: before
                // it starts, and again after the controller read that decides
                // it. Only work not yet sent is gated.
                const abortIfGone = () => {
                    if (unmountedRef.current) throw new SpendRecoveryAbortedError(e)
                }
                const eligible = !signRecovered && !userCancelled && !unmountedRef.current
                const rotated = eligible && (isRainControllerChanged(e) || (await controllerMovedSincePrepare()))

                /** The replacement attempt. Returns the fresh artifact, or
                 *  throws what the caller should see — every exit from here
                 *  lands on the ONE cleanup path below. */
                const runReplacement = async (): Promise<SignedSpendArtifact> => {
                    abortIfGone()
                    signRecovered = true
                    recoveryTrigger = e
                    if (livePreparationId) void rainApi.cancelPreparation(livePreparationId)
                    livePreparationId = undefined
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, {
                        strategy,
                        kind,
                        flow: 'sign-only',
                        recovery: 'controller-changed',
                    })
                    try {
                        const replacement = await runSignAttempt()
                        // Prepare + grant + signing can outlive the screen; the
                        // caller would submit whatever comes back.
                        abortIfGone()
                        return replacement
                    } catch (again) {
                        // The recovery owns its own 425 (the global explainer is
                        // suppressed for it): wait it out when the payment's own
                        // quote can still cover the wait plus signing, otherwise
                        // hand the cooldown to the call site for quote review.
                        // The user answering "no" to a prompt the RECOVERY put up
                        // is control flow, not a failed payment.
                        if (isUserCancellation(again)) throw new SpendRecoveryAbortedError(e)
                        if (!(again instanceof RainCooldownError)) throw again
                        const retryAfterSec = again.retryAfterSec ?? undefined
                        const waitMs = (retryAfterSec ?? 0) * 1000 + RESIGN_MARGIN_MS
                        const fitsLock = !!retryAfterSec && !!lockExpiresAt && Date.now() + waitMs <= lockExpiresAt
                        if (!fitsLock) throw new SpendRecoveryQuoteReviewError(again, retryAfterSec)
                        if (!(await sleepUnlessCancelled(waitMs - RESIGN_MARGIN_MS, () => unmountedRef.current))) {
                            throw new SpendRecoveryAbortedError(again)
                        }
                        try {
                            abortIfGone()
                            const replacement = await runSignAttempt()
                            abortIfGone()
                            return replacement
                        } catch (final) {
                            if (isUserCancellation(final)) throw new SpendRecoveryAbortedError(e)
                            if (final instanceof RainCooldownError) {
                                throw new SpendRecoveryQuoteReviewError(final, final.retryAfterSec ?? undefined)
                            }
                            throw final
                        }
                    }
                }

                // What the caller ends up seeing: the original failure, or the
                // one the replacement ended on.
                let failure: unknown = e
                if (rotated) {
                    try {
                        return await runReplacement()
                    } catch (recoveryFailure) {
                        failure = recoveryFailure
                    }
                }

                /*
                 * ONE failure exit for both attempts. Back the abandoned draft
                 * out — the replacement's prep included, since a recovery that
                 * ended badly leaves its own standalone draft behind.
                 * Fire-and-forget: the backend refuses while the Rain signature
                 * could still execute, and the TTL sweep is the guaranteed
                 * cleanup either way (TASK-21815). Cancelling is local hygiene,
                 * never a Rain unlock.
                 */
                if (livePreparationId) void rainApi.cancelPreparation(livePreparationId)
                // Typed recovery outcomes are control flow — the payment is
                // still open at the call site, so no cache repair and no
                // failed-payment telemetry for them.
                if (!isSpendRecoveryOutcome(failure)) {
                    // A Rain leg that died client-side may have been built on a
                    // controller the backend cached before Rain rotated it.
                    // Cache-only: nothing is re-signed and the error below stands.
                    void repairRainController({ strategy, error: failure })
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
                        strategy,
                        kind,
                        flow: 'sign-only',
                        error_kind: (failure as Error)?.name ?? 'unknown',
                        error_message: (failure as Error)?.message,
                        ...(failure === e ? {} : { recovery: 'controller-changed' }),
                    })
                }
                throw failure
            }
        },
        [
            getClientForChain,
            rebuildClientForChain,
            getPatchedSudoValidator,
            handleSendUserOpEncoded,
            modals,
            signCallsUserOp,
            overview,
            refetchOverview,
            grant,
            repairRainController,
            queryClient,
        ]
    )

    // Brackets every ceremony one spend triggers as a flow (sign_spend:<kind>) so
    // the prompt count per kind is measurable; link_create nests inside it.
    const signSpend = useCallback(
        (input: SignSpendBundleInput) => {
            let strategy: string | undefined
            return withCeremonyFlow(
                `sign_spend:${input.kind}`,
                () =>
                    signSpendInner({
                        ...input,
                        onStrategyDecided: (decided) => {
                            strategy = decided
                            input.onStrategyDecided?.(decided)
                        },
                    }),
                () => ({ strategy })
            )
        },
        [signSpendInner]
    )

    return { signSpend }
}
