'use client'

import { useCallback, useReducer, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { Address } from 'viem'
import posthog from 'posthog-js'
import * as Sentry from '@/utils/sentry-lazy'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useSignSpendBundle, type SignedSpendArtifact } from '@/hooks/wallet/useSignSpendBundle'
import { useRainControllerRepair } from '@/hooks/wallet/useRainControllerRepair'
import { useSignedSpendRecovery } from '@/hooks/wallet/useSignedSpendRecovery'
import {
    isRainControllerChanged,
    isSpendRecoveryOutcome,
    isStructuredBroadcastFailure,
    SpendRecoveryQuoteReviewError,
    submitSignedSpend,
} from '@/hooks/wallet/signSpendRetry'
import {
    pixApi,
    type PixWithdrawDisplay,
    type PixWithdrawRequest,
    type PixWithdrawSign,
    type PixWithdrawSubmitRequest,
} from '@/services/pix'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { useAuth } from '@/context/authContext'
import { quoteMovedAgainstUser, signMatchesDisplay } from '@/features/pix/pixFlow.utils'
import { pixSignedFunding } from '@/features/pix/pixSignedFunding'
import { clearDepositMaybeSent, markDepositMaybeSent } from '@/features/pix/pixWithdrawSent'
import {
    clearTransferPending,
    canKeepTransferMark,
    markTransferPending,
    PENDING_TRANSFER_MARGIN_MS,
} from '@/features/pix/pixWithdrawPending'
import {
    canSignOpened,
    INITIAL_WITHDRAW_SUBMIT,
    openedWithdrawal,
    withdrawSubmitReducer,
    type OpenedWithdrawal,
    type WithdrawSubmitEvent,
    type WithdrawSubmitPhase,
    type WithdrawSubmitState,
} from '@/features/pix/pixWithdrawSubmitReducer'
import { usePixRefusalMessage } from '@/features/pix/usePixRefusalMessage'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { BALANCE_DECREASE, PIX_WITHDRAW, TRANSACTIONS } from '@/constants/query.consts'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { isUserCancellation } from '@/hooks/wallet/spendPreflight'
import { areEvmAddressesEqual, isTxReverted } from '@/utils/general.utils'
import { rainCentsToUsdcUnits } from '@/utils/balance.utils'
import { friendlyError } from '@/utils/friendly-error.utils'
import { captureNetworkTriagedFailure, isNetworkLayerFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { rhinoDepositWithIdCalls } from '@/utils/rhino-deposit.utils'

const flowTags = (step: string) => ({ ...criticalFlowTags('withdraw-pix'), withdraw_step: step })

type DepositWithIdSign = Extract<PixWithdrawSign, { kind: 'deposit-with-id' }>
type TransferSign = Extract<PixWithdrawSign, { kind: 'transfer-then-submit' }>

/**
 * A submit the API answered before it broadcast moved nothing: a refusal (4xx), the route's pause
 * (503), a broadcast that provably reverted, or a card controller that changed before the order.
 * A 502 or a lost answer can come after the broadcast.
 */
function submitSentNothing(caught: unknown): boolean {
    const status = apiErrorStatus(caught)
    return (
        isStructuredBroadcastFailure(caught) ||
        isRainControllerChanged(caught) ||
        (status !== undefined && ((status >= 400 && status < 500) || status === 503))
    )
}

export interface PixWithdrawSubmit {
    /** Opens the withdrawal for the reviewed quote; signs at once unless the opened quote is worse. */
    submit: (request: PixWithdrawRequest, reviewed: PixWithdrawDisplay) => Promise<void>
    /**
     * Signs the opened withdrawal: after the user saw its new amounts (phase `reconfirm`),
     * or once more after a signature that surely sent nothing (`canSignOpened`).
     */
    confirmOpened: () => Promise<void>
    /**
     * The opened withdrawal can be signed now: its quote moved and waits for the user, or the
     * first signature was dismissed or reverted. One such re-sign per withdrawal, while its quote
     * holds; after an unexplained failure the funding may have gone out, so never.
     */
    canSignOpened: boolean
    /** The states are documented on `WithdrawSubmitState`. */
    phase: WithdrawSubmitPhase
    /** The opened withdrawal: its id once the provider holds it, and what the review and success screens show. */
    opened: { intentId: string | null; display: PixWithdrawDisplay } | null
    error: string | null
    /**
     * True once Confirm opened a withdrawal. From then on only that withdrawal can be signed: a
     * second one could pay twice, and the API refuses one while the first is open anyway.
     */
    lockedAfterInit: boolean
}

/**
 * Confirm of a Pix withdrawal. POST /pix/withdraw opens it with the provider the route names and
 * says how the wallet funds it (`sign.kind`), the one provider difference this hook handles:
 *
 * - `deposit-with-id`: the withdrawal is open at once. The wallet approves the token and calls
 *   depositWithId on the bridge contract (the same calls as a cross-chain bridge commit), then the
 *   app reports the mined transaction.
 * - `transfer-then-submit`: nothing is open yet. The wallet signs a transfer to the deposit address
 *   without broadcasting it; POST /pix/withdraw/submit opens the payout order for the locked price,
 *   then broadcasts, so no money leaves for an order that could not open. A submit whose answer is
 *   lost may still have paid: it reads as not confirmed (`unconfirmed`), and a device mark for this
 *   account and this price lock (`pixWithdrawPending`) keeps the page on it after a reload, in any
 *   tab and after a logout, until the lock's window has passed. A browser that cannot keep the
 *   mark signs nothing.
 *
 * The open quotes again, seconds after the review. When that quote takes any more USD or pays any
 * fewer reais than the reviewed one, nothing is signed until the user confirms the new amounts.
 *
 * `onOpened` gets the withdrawal's id once the provider holds it (null when the submit could not
 * name it), so the flow can put it in the URL. Funding is a balance-decreasing mutation: while one
 * is pending (`usePendingTransactions`), no second withdrawal opens.
 */
export function usePixWithdrawSubmit({
    provider,
    onOpened,
}: {
    /** The route's provider, for analytics only. */
    provider?: string | null
    onOpened?: (intentId: string | null) => void
} = {}): PixWithdrawSubmit {
    const tShared = useTranslations('pix')
    const refusalMessage = usePixRefusalMessage()
    const toFriendlyError = useFriendlyError()
    const queryClient = useQueryClient()
    const { fetchUser, user } = useAuth()
    const userId = user?.user?.userId
    const { sendTransactions } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const repairRainController = useRainControllerRepair()
    const recoverSignedSpend = useSignedSpendRecovery()
    const { overview: rainCardOverview } = useRainCardOverview()
    const { hasPendingTransactions } = usePendingTransactions()
    const { mutateAsync: sendDeposit } = useMutation({
        mutationKey: [BALANCE_DECREASE, PIX_WITHDRAW],
        // a second send of the same deposit could pay twice
        retry: false,
        mutationFn: ({ request, amount }: { request: DepositWithIdSign; amount: bigint }) =>
            sendTransactions(
                rhinoDepositWithIdCalls({
                    tokenAddress: request.tokenAddress as Address,
                    contractAddress: request.contractAddress as Address,
                    amount,
                    commitmentId: request.commitmentId,
                }),
                {
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    // the pay amount, so the collateral top-up covers what leaves
                    requiredUsdcAmount: amount,
                    kind: 'FIAT_OFFRAMP',
                }
            ),
    })
    const { mutateAsync: submitTransfer } = useMutation({
        mutationKey: [BALANCE_DECREASE, PIX_WITHDRAW],
        // the API broadcasts; a second submit of the same transfer could pay twice
        retry: false,
        mutationFn: (run: () => Promise<Awaited<ReturnType<typeof pixApi.submitWithdrawal>>>) => run(),
    })
    const [state, dispatchToReact] = useReducer(withdrawSubmitReducer, INITIAL_WITHDRAW_SUBMIT)
    // React applies a dispatch at the next render. The handlers read this copy, which every dispatch
    // moves at once, so a second tap in the same tick can neither open nor sign a second time.
    const latest = useRef<WithdrawSubmitState>(INITIAL_WITHDRAW_SUBMIT)
    const dispatch = useCallback((event: WithdrawSubmitEvent) => {
        latest.current = withdrawSubmitReducer(latest.current, event)
        dispatchToReact(event)
    }, [])

    /** A failure on the money leg: analytics, and Sentry when it is not a user action or a known state. */
    const reportSignFailure = useCallback(
        (caught: unknown, intentId: string | null) => {
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, { method_type: provider, stage: 'sign' })
            const classified = friendlyError(caught)
            if ((classified.kind === 'code' && classified.code === 'genericSupport') || isNetworkLayerFailure(caught)) {
                void captureNetworkTriagedFailure(caught, { tags: flowTags('sign'), extra: { intentId } })
            }
        },
        [provider]
    )

    const signDeposit = useCallback(
        async (withdrawal: OpenedWithdrawal & { intentId: string }, request: DepositWithIdSign) => {
            const { intentId } = withdrawal
            // the bridge quote lives minutes; a deposit on an expired commitment is not bridged
            if (!(Date.parse(request.quoteExpiresAt) > Date.now())) {
                dispatch({ type: 'QUOTE_EXPIRED', withdrawal, error: tShared('withdraw.errors.quoteExpired') })
                return
            }
            dispatch({ type: 'SIGN_START', withdrawal })
            const amount = BigInt(request.payAmountUnits)
            let minedHash: string | undefined
            let reverted = false
            // from here a deposit may leave the wallet; a reload must not read it as never signed
            markDepositMaybeSent(intentId)
            try {
                const result = await sendDeposit({ request, amount })
                if (result.receipt && isTxReverted(result.receipt)) {
                    reverted = true
                    throw new Error(`Transaction failed (reverted). Hash: ${result.receipt.transactionHash}`)
                }
                minedHash = result.receipt?.transactionHash
            } catch (caught) {
                reportSignFailure(caught, intentId)
                // A dismissed passkey or a reverted transaction moved nothing, so the withdrawal can be
                // signed once more. Any other failure may have sent the deposit: never again.
                const nothingSent = reverted || isUserCancellation(caught)
                if (nothingSent) clearDepositMaybeSent(intentId)
                dispatch({ type: nothingSent ? 'SENT_NOTHING' : 'MAYBE_SENT', error: toFriendlyError(caught) })
                return
            }
            void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            if (!minedHash) {
                // the wallet could not resolve the receipt: the deposit may still land, or fail
                dispatch({ type: 'NO_RECEIPT' })
                return
            }
            dispatch({ type: 'MINED' })
            // Optional for the money (the provider's events move it either way); it names the
            // funding transaction on the receipt sooner. Only a mined hash can be checked.
            pixApi.reportFunding(intentId, minedHash).catch((caught) => {
                Sentry.captureException(caught, { tags: flowTags('report-funding'), extra: { intentId } })
            })
        },
        [dispatch, queryClient, reportSignFailure, sendDeposit, tShared, toFriendlyError]
    )

    const signTransfer = useCallback(
        async (withdrawal: OpenedWithdrawal, request: TransferSign) => {
            // The locked price bounds every attempt: a passkey sheet is unbounded, and a recovery
            // re-sign comes later still. An expired lock submits nothing.
            const lockExpiresAt = Date.parse(request.quoteExpiresAt)
            const expired = () => !(lockExpiresAt > Date.now())
            const quoteExpired = tShared('withdraw.errors.quoteExpired')
            if (expired()) {
                dispatch({ type: 'QUOTE_EXPIRED', withdrawal, error: quoteExpired })
                return
            }
            // The guard against a second payout after a lost answer is a mark this browser keeps.
            // Where it cannot keep one (storage blocked, full or private), nothing is signed: the
            // withdrawal stops before the signature, as an expired lock does.
            const noRecord = tShared('withdraw.errors.noRecord')
            if (!userId || !canKeepTransferMark()) {
                dispatch({ type: 'QUOTE_EXPIRED', withdrawal, error: noRecord })
                return
            }
            dispatch({ type: 'SIGN_START', withdrawal })
            const signInput = () => ({
                requiredUsdcAmount: BigInt(request.payAmountUnits),
                recipient: request.depositAddress as Address,
                rainSpendingPower: rainCentsToUsdcUnits(rainCardOverview?.balance?.spendingPower),
                kind: 'FIAT_OFFRAMP' as const,
                lockExpiresAt,
            })
            let artifact: SignedSpendArtifact
            try {
                artifact = await signSpend(signInput())
            } catch (caught) {
                // nothing is ordered or broadcast before the submit: any signing failure sent nothing
                reportSignFailure(caught, null)
                dispatch({
                    type: 'SENT_NOTHING',
                    error: caught instanceof SpendRecoveryQuoteReviewError ? quoteExpired : toFriendlyError(caught),
                })
                return
            }
            if (expired()) {
                dispatch({ type: 'SENT_NOTHING', error: quoteExpired })
                return
            }
            const body = (candidate: SignedSpendArtifact): PixWithdrawSubmitRequest => ({
                priceLockCode: request.priceLockCode,
                pixKey: withdrawal.display.pixKey,
                amountUsd: request.payAmount,
                funding: pixSignedFunding(candidate),
            })
            // From here the payout may go out with no answer naming it: the device keeps this lock's
            // mark until the API refuses this submit, the answer names the withdrawal, or the lock's
            // window has passed. A mark that did not hold sends nothing: the signature is dropped unsent.
            const marked = markTransferPending(userId, {
                priceLockCode: request.priceLockCode,
                display: withdrawal.display,
                submittedAt: Date.now(),
                settleBy: lockExpiresAt + PENDING_TRANSFER_MARGIN_MS,
            })
            if (!marked) {
                dispatch({ type: 'SENT_NOTHING', error: noRecord })
                return
            }
            let submitted: Awaited<ReturnType<typeof pixApi.submitWithdrawal>>
            try {
                submitted = await submitTransfer(() =>
                    submitSignedSpend(
                        artifact,
                        (candidate) => {
                            if (expired()) {
                                throw new SpendRecoveryQuoteReviewError(new Error('quote expired before send'))
                            }
                            return pixApi.submitWithdrawal(body(candidate))
                        },
                        {
                            // observes the final failure only: the card controller's cache repair, no retry
                            onFailure: (failure) =>
                                isSpendRecoveryOutcome(failure)
                                    ? undefined
                                    : void repairRainController({ strategy: artifact.strategy, error: failure }),
                            // the same lock and terms: only the card preparation and the signature are fresh
                            recover: (failure, current) =>
                                recoverSignedSpend(
                                    failure,
                                    current,
                                    () => signSpend({ ...signInput(), suppressCooldownEvent: true }),
                                    { lockExpiresAt }
                                ),
                        }
                    )
                )
            } catch (caught) {
                reportSignFailure(caught, null)
                // a recovery that handed back, or an answer from before the broadcast, moved nothing
                if (isSpendRecoveryOutcome(caught) || submitSentNothing(caught)) {
                    // only this submit's mark: another tab's withdrawal keeps its own
                    clearTransferPending(userId, request.priceLockCode)
                    dispatch({
                        type: 'SENT_NOTHING',
                        error: isSpendRecoveryOutcome(caught)
                            ? quoteExpired
                            : wireErrorCode(caught)
                              ? refusalMessage(caught)
                              : toFriendlyError(caught),
                    })
                    return
                }
                // A lost answer, or a failure after the broadcast: the payout may be on its way. The
                // last step says it is not confirmed yet, the mark stays for a reload, and the URL
                // drops the form, so nothing offers the same withdrawal again.
                dispatch({ type: 'NO_RECEIPT' })
                onOpened?.(null)
                return
            }
            void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            // a named withdrawal is the URL's from now on; an unnamed one keeps the mark until history shows it
            if (submitted.intentId) clearTransferPending(userId, request.priceLockCode)
            dispatch({ type: 'SUBMITTED', intentId: submitted.intentId })
            onOpened?.(submitted.intentId)
        },
        [
            dispatch,
            onOpened,
            queryClient,
            rainCardOverview?.balance?.spendingPower,
            recoverSignedSpend,
            refusalMessage,
            repairRainController,
            reportSignFailure,
            signSpend,
            submitTransfer,
            tShared,
            toFriendlyError,
            userId,
        ]
    )

    const sign = useCallback(
        async (withdrawal: OpenedWithdrawal) => {
            const { sign: request, intentId } = withdrawal
            if (request.kind === 'transfer-then-submit') return signTransfer(withdrawal, request)
            // `submit` dispatches a deposit-with-id withdrawal only with its id
            if (intentId) return signDeposit({ ...withdrawal, intentId }, request)
        },
        [signDeposit, signTransfer]
    )

    const submit = useCallback(
        async (request: PixWithdrawRequest, reviewed: PixWithdrawDisplay) => {
            if (latest.current.phase !== 'idle' || hasPendingTransactions) return
            dispatch({ type: 'SUBMIT' })
            let init: Awaited<ReturnType<typeof pixApi.openWithdrawal>>
            try {
                init = await pixApi.openWithdrawal(request)
            } catch (caught) {
                const code = wireErrorCode(caught)
                posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                    method_type: provider,
                    stage: 'init',
                    error_code: code ?? 'unknown',
                })
                // a wire code is the API's own refusal; anything else is a failure to look at
                if (!code) void captureNetworkTriagedFailure(caught, { tags: flowTags('init') })
                dispatch({ type: 'INIT_REFUSED', error: refusalMessage(caught) })
                // the route moved since the screen loaded: the capabilities say where the user stands now
                if (code === API_ERROR_CODES.ROUTE_NOT_AVAILABLE || code === API_ERROR_CODES.PROVIDER_UNAVAILABLE) {
                    void fetchUser().catch(() => undefined)
                }
                return
            }
            const withdrawal: OpenedWithdrawal = { intentId: init.intentId, display: init.display, sign: init.sign }
            // a deposit-with-id withdrawal is open now; a transfer-then-submit one opens at its submit
            if (init.sign.kind === 'deposit-with-id' && init.intentId) onOpened?.(init.intentId)
            // The wallet only ever spends its own USDC, for exactly the USD the user is shown, and
            // a deposit-with-id withdrawal is always open; anything else is a contract break.
            if (
                !areEvmAddressesEqual(init.sign.tokenAddress, PEANUT_WALLET_TOKEN) ||
                !signMatchesDisplay(init.display, init.sign) ||
                (init.sign.kind === 'deposit-with-id' && !init.intentId)
            ) {
                Sentry.captureException(new Error('Pix withdrawal sign request off-contract'), {
                    tags: flowTags('sign-request'),
                    extra: { intentId: init.intentId, kind: init.sign.kind },
                })
                dispatch({ type: 'OFF_CONTRACT', withdrawal, error: tShared('unavailable') })
                return
            }
            if (quoteMovedAgainstUser(reviewed, init.display)) {
                dispatch({ type: 'QUOTE_MOVED', withdrawal })
                return
            }
            await sign(withdrawal)
        },
        [dispatch, fetchUser, hasPendingTransactions, onOpened, provider, refusalMessage, sign, tShared]
    )

    const confirmOpened = useCallback(async () => {
        const withdrawal = openedWithdrawal(latest.current)
        if (withdrawal && canSignOpened(latest.current)) await sign(withdrawal)
    }, [sign])

    const withdrawal = openedWithdrawal(state)
    return {
        submit,
        confirmOpened,
        canSignOpened: canSignOpened(state),
        phase: state.phase,
        opened: withdrawal ? { intentId: withdrawal.intentId, display: withdrawal.display } : null,
        error: state.phase === 'idle' || state.phase === 'opened' ? state.error : null,
        lockedAfterInit: !!withdrawal,
    }
}
