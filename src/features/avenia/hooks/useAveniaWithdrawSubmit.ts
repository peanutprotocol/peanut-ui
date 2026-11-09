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
import {
    aveniaApi,
    type AveniaWithdrawDisplay,
    type AveniaWithdrawRequest,
    type AveniaWithdrawSign,
} from '@/services/avenia'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import { useAuth } from '@/context/authContext'
import { quoteMovedAgainstUser, signMatchesDisplay } from '@/features/avenia/avenia.utils'
import { clearDepositMaybeSent, markDepositMaybeSent } from '@/features/avenia/aveniaWithdrawSent'
import {
    canSignOpened,
    INITIAL_WITHDRAW_SUBMIT,
    openedWithdrawal,
    withdrawSubmitReducer,
    type OpenedWithdrawal,
    type WithdrawSubmitEvent,
    type WithdrawSubmitPhase,
    type WithdrawSubmitState,
} from '@/features/avenia/aveniaWithdrawSubmitReducer'
import { useAveniaRefusalMessage } from '@/features/avenia/hooks/useAveniaRefusalMessage'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { BALANCE_DECREASE, PIX_WITHDRAW, TRANSACTIONS } from '@/constants/query.consts'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { isUserCancellation } from '@/hooks/wallet/spendPreflight'
import { areEvmAddressesEqual, isTxReverted } from '@/utils/general.utils'
import { friendlyError } from '@/utils/friendly-error.utils'
import { captureNetworkTriagedFailure, isNetworkLayerFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { rhinoDepositWithIdCalls } from '@/utils/rhino-deposit.utils'

const flowTags = (step: string) => ({ ...criticalFlowTags('withdraw-avenia'), withdraw_step: step })

export interface AveniaWithdrawSubmit {
    /** Opens the withdrawal for the reviewed quote; signs at once unless the opened quote is worse. */
    submit: (request: AveniaWithdrawRequest, reviewed: AveniaWithdrawDisplay) => Promise<void>
    /**
     * Signs the opened withdrawal: after the user saw its new amounts (phase `reconfirm`),
     * or once more after a signature that surely sent nothing (`canSignOpened`).
     */
    confirmOpened: () => Promise<void>
    /**
     * The opened withdrawal can be signed now: its quote moved and waits for the user, or the
     * first signature was dismissed or reverted. One such re-sign per ticket, while Rhino's quote
     * holds; after an unexplained failure the deposit may have gone out, so never.
     */
    canSignOpened: boolean
    /** The states are documented on `WithdrawSubmitState`. */
    phase: WithdrawSubmitPhase
    /** The opened withdrawal: what the wallet signs, and what the review and success screens show. */
    opened: { intentId: string; display: AveniaWithdrawDisplay } | null
    error: string | null
    /**
     * True once Avenia's ticket is open. From then on only that ticket can be
     * signed: a second withdrawal could pay twice, and the API refuses one
     * while the first ticket is open anyway.
     */
    lockedAfterInit: boolean
}

/**
 * Confirm of a Pix withdrawal: POST /avenia/withdraw/init opens Avenia's
 * ticket and commits Rhino's quote, then the wallet signs the Rhino deposit
 * (approve + depositWithId, the same calls as a cross-chain bridge commit)
 * and the app reports the mined transaction. Rhino delivers the USDC to the
 * user's Avenia wallet on Base and Avenia pays the Pix.
 *
 * Init quotes again, seconds after the review. When that quote takes any more
 * USD or pays any fewer reais than the reviewed one, nothing is signed until
 * the user confirms the new amounts.
 *
 * `onOpened` gets the withdrawal's id as soon as the ticket is open, before
 * anything is signed, so the flow can put it in the URL. The signature is a
 * balance-decreasing mutation: while one is pending (`usePendingTransactions`),
 * no second withdrawal opens.
 */
export function useAveniaWithdrawSubmit({
    onOpened,
}: { onOpened?: (intentId: string) => void } = {}): AveniaWithdrawSubmit {
    const tShared = useTranslations('avenia')
    const initError = useAveniaRefusalMessage()
    const toFriendlyError = useFriendlyError()
    const queryClient = useQueryClient()
    const { fetchUser } = useAuth()
    const { sendTransactions } = useWallet()
    const { hasPendingTransactions } = usePendingTransactions()
    const { mutateAsync: sendDeposit } = useMutation({
        mutationKey: [BALANCE_DECREASE, PIX_WITHDRAW],
        // a second send of the same deposit could pay twice
        retry: false,
        mutationFn: ({ request, amount }: { request: AveniaWithdrawSign; amount: bigint }) =>
            sendTransactions(
                rhinoDepositWithIdCalls({
                    tokenAddress: request.tokenAddress as Address,
                    contractAddress: request.contractAddress as Address,
                    amount,
                    commitmentId: request.commitmentId,
                }),
                {
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    // Rhino's pay amount, so the collateral top-up covers what leaves
                    requiredUsdcAmount: amount,
                    kind: 'FIAT_OFFRAMP',
                }
            ),
    })
    const [state, dispatchToReact] = useReducer(withdrawSubmitReducer, INITIAL_WITHDRAW_SUBMIT)
    // React applies a dispatch at the next render. The handlers read this copy, which every dispatch
    // moves at once, so a second tap in the same tick can neither open nor sign a second time.
    const latest = useRef<WithdrawSubmitState>(INITIAL_WITHDRAW_SUBMIT)
    const dispatch = useCallback((event: WithdrawSubmitEvent) => {
        latest.current = withdrawSubmitReducer(latest.current, event)
        dispatchToReact(event)
    }, [])

    const sign = useCallback(
        async (withdrawal: OpenedWithdrawal) => {
            const { intentId, sign: request } = withdrawal
            // Rhino's quote lives 3 minutes; a deposit on an expired commitment is not bridged
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
                posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, { method_type: 'avenia', stage: 'sign' })
                // A classified error is a user action or a known state; an unclassified or network
                // failure on the money leg is what prod-watch must see (as on the Manteca flow).
                const classified = friendlyError(caught)
                if (
                    (classified.kind === 'code' && classified.code === 'genericSupport') ||
                    isNetworkLayerFailure(caught)
                ) {
                    void captureNetworkTriagedFailure(caught, { tags: flowTags('sign'), extra: { intentId } })
                }
                // A dismissed passkey or a reverted transaction moved nothing, so the ticket can be
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
            // Optional for the money (Avenia's webhook moves it either way); it names the
            // funding transaction on the receipt sooner. Only a mined hash can be checked.
            aveniaApi.reportFunding(intentId, minedHash).catch((caught) => {
                Sentry.captureException(caught, { tags: flowTags('report-funding'), extra: { intentId } })
            })
        },
        [dispatch, queryClient, sendDeposit, tShared, toFriendlyError]
    )

    const submit = useCallback(
        async (request: AveniaWithdrawRequest, reviewed: AveniaWithdrawDisplay) => {
            if (latest.current.phase !== 'idle' || hasPendingTransactions) return
            dispatch({ type: 'SUBMIT' })
            let init: Awaited<ReturnType<typeof aveniaApi.initWithdrawal>>
            try {
                init = await aveniaApi.initWithdrawal(request)
            } catch (caught) {
                const code = wireErrorCode(caught)
                posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                    method_type: 'avenia',
                    stage: 'init',
                    error_code: code ?? 'unknown',
                })
                // a wire code is the API's own refusal; anything else is a failure to look at
                if (!code) void captureNetworkTriagedFailure(caught, { tags: flowTags('init') })
                dispatch({ type: 'INIT_REFUSED', error: initError(caught) })
                // the route moved since the screen loaded: the capabilities say where the user stands now
                if (code === API_ERROR_CODES.ROUTE_NOT_AVAILABLE || code === API_ERROR_CODES.PROVIDER_UNAVAILABLE) {
                    void fetchUser().catch(() => undefined)
                }
                return
            }
            const withdrawal: OpenedWithdrawal = { intentId: init.intentId, display: init.display, sign: init.sign }
            onOpened?.(init.intentId)
            // The wallet only ever approves its own USDC, for exactly the USD the user is shown;
            // anything else is a contract break.
            if (
                init.sign.kind !== 'deposit-with-id' ||
                !areEvmAddressesEqual(init.sign.tokenAddress, PEANUT_WALLET_TOKEN) ||
                !signMatchesDisplay(init.display, init.sign)
            ) {
                Sentry.captureException(new Error('Avenia withdrawal sign request off-contract'), {
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
        [dispatch, fetchUser, hasPendingTransactions, initError, onOpened, sign, tShared]
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
