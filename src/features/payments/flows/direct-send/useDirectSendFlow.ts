'use client'

/**
 * hook for direct send flow
 *
 * handles the full payment lifecycle for direct sends to peanut users:
 * 1. validates amount and checks balance
 * 2. creates a charge in backend
 * 3. sends usdc via peanut wallet
 * 4. records the payment to backend
 *
 * note: no cross-chain, always usdc on arbitrum
 */

import { useCallback, useContext, useMemo } from 'react'
import { type Address } from 'viem'
import { loadingStateContext } from '@/context/loadingStates.context'
import { useDirectSendFlowContext } from './DirectSendFlowContext'
import { chargesApi } from '@/services/charges'
import { usePendingChargeSend } from '@/features/payments/shared/hooks/usePendingChargeSend'
import { chargeOrderState, type PendingChargeSend } from '@/features/payments/shared/utils/pending-charge-send'
import { useChargeManager } from '@/features/payments/shared/hooks/useChargeManager'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { useWallet } from '@/hooks/wallet/useWallet'
import { SpendRecoveryAbortedError } from '@/hooks/wallet/signSpendRetry'
import { useAuth } from '@/context/authContext'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { captureNetworkTriagedFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { resolveSettledTxHash } from '@/utils/settled-tx-hash.utils'
import { isDemoMode } from '@/utils/demo'

export function useDirectSendFlow() {
    const t = useTranslations('payment')
    const toFriendlyError = useFriendlyError()
    const {
        amount,
        setAmount,
        usdAmount,
        setUsdAmount,
        currentView,
        setCurrentView,
        recipient,
        attachment,
        setAttachment,
        charge,
        setCharge,
        payment,
        setPayment,
        txHash,
        setTxHash,
        error,
        setError,
        isLoading,
        setIsLoading,
        isSuccess,
        setIsSuccess,
        resetSendFlow,
    } = useDirectSendFlowContext()

    const { user } = useAuth()
    // Mirrored into the global loading context so useStaleDeploymentReload's
    // safety gate sees this flow: a resume-triggered reload mid-payment (every
    // passkey prompt backgrounds the app) would wipe the in-memory step-up
    // cache and force extra signature prompts — or worse, reload between the
    // on-chain send and recordPayment.
    const { setLoadingState } = useContext(loadingStateContext)
    const { createCharge, isCreating: isCreatingCharge } = useChargeManager()
    const { recordPayment, isRecording } = usePaymentRecorder()
    const {
        isConnected,
        address: walletAddress,
        sendMoney,
        formattedSpendableBalance,
        spendableBalanceDecimal,
        hasSufficientSpendableBalance: hasSufficientBalance,
        isFetchingSpendableBalance,
    } = useWallet()

    const readCharge = useCallback(
        async ({ chargeId }: PendingChargeSend) => {
            const found = await chargesApi.get(chargeId)
            return { state: chargeOrderState(found.status), show: () => setCharge(found) }
        },
        [setCharge]
    )
    const recordFoundPayment = useCallback(
        async ({ chargeId }: PendingChargeSend, txHash: string) => {
            const payment = await recordPayment({
                chargeId,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                txHash,
                tokenAddress: PEANUT_WALLET_TOKEN as Address,
                payerAddress: walletAddress as Address,
            })
            return () => setPayment(payment)
        },
        [recordPayment, walletAddress, setPayment]
    )
    const pendingSend = usePendingChargeSend({
        intent: recipient ? `direct-send:${recipient.address.toLowerCase()}` : null,
        walletAddress: walletAddress as Address | undefined,
        readOrder: readCharge,
        recordPayment: recordFoundPayment,
        canResume: currentView === 'INITIAL',
        setIsSuccess,
        setCurrentView,
        setError,
    })

    const isLoggedIn = !!user?.user?.userId

    // set amount (for peanut wallet, amount is always in usd)
    const handleSetAmount = useCallback(
        (value: string) => {
            setAmount(value)
            setUsdAmount(value)
        },
        [setAmount, setUsdAmount]
    )

    // clear error
    const clearError = useCallback(() => {
        setError({ showError: false, errorMessage: '' })
    }, [setError])

    // check if can proceed
    const canProceed = useMemo(() => {
        if (!amount || !recipient) return false
        const amountNum = parseFloat(amount)
        if (isNaN(amountNum) || amountNum <= 0) return false
        return true
    }, [amount, recipient])

    // check if has sufficient balance for current amount
    const hasEnoughBalance = useMemo(() => {
        if (!amount) return false
        return hasSufficientBalance(amount)
    }, [amount, hasSufficientBalance])

    // check if should show insufficient balance error
    // gate on !isFetchingSpendableBalance so we wait for both smart-account
    // and Rain collateral to settle. See useSemanticRequestFlow for the
    // same fix + reasoning (TASK-19573).
    const isInsufficientBalance = useMemo(() => {
        return (
            isLoggedIn &&
            !!amount &&
            !hasEnoughBalance &&
            !isFetchingSpendableBalance &&
            !isLoading &&
            !isCreatingCharge &&
            !isRecording
        )
    }, [isLoggedIn, amount, hasEnoughBalance, isFetchingSpendableBalance, isLoading, isCreatingCharge, isRecording])

    // execute the payment (called from input view)
    const executePayment = useCallback(async () => {
        if (!recipient || !amount || !walletAddress) {
            setError({ showError: true, errorMessage: t('errors.missingData') })
            return
        }
        // a send for this recipient may still land, or a tap in this tick started one:
        // Pay stays off until it is final
        if (!pendingSend.claim()) return

        setIsLoading(true)
        setLoadingState('Loading')
        clearError()

        let failedStep: 'create-charge' | 'send-money' | 'record-payment' = 'create-charge'
        let chargeId: string | undefined

        try {
            const t0 = Date.now()
            // step 1: create charge
            const chargeResult = await createCharge({
                tokenAmount: amount,
                tokenAddress: PEANUT_WALLET_TOKEN as Address,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                tokenSymbol: 'USDC',
                tokenDecimals: PEANUT_WALLET_TOKEN_DECIMALS,
                recipientAddress: recipient.address,
                transactionType: 'DIRECT_SEND',
                reference: attachment.message,
                attachment: attachment.file,
                currencyAmount: usdAmount,
                currencyCode: 'USD',
            })

            setCharge(chargeResult)
            chargeId = chargeResult.uuid
            const tChargeCreated = Date.now()
            failedStep = 'send-money'
            pendingSend.begin(chargeResult.uuid)

            // step 2: send money via peanut wallet
            const txResult = await sendMoney(recipient.address, amount, {
                kind: 'P2P_SEND',
                // Lets the backend settle the charge directly when the spend routes
                // through Rain card collateral (the on-chain validator can't verify
                // a collateral-contract tx). recordPayment below is then routed
                // through the same trusted-completion path.
                chargeId: chargeResult.uuid,
                onBroadcast: pendingSend.onBroadcast,
            })
            const { hash, source: txHashSource } = resolveSettledTxHash(txResult, 'direct-send')
            const tMoneySent = Date.now()

            // Only markSent with a real mined/broadcast tx hash; a userOpHash
            // fallback is not an on-chain tx hash and would skip ReadUserOps in
            // recovery, leaving a reverted op held for 24h.
            if (txHashSource !== 'userOpHash') pendingSend.markSent(hash)
            else pendingSend.markPostSend()
            setTxHash(hash)
            failedStep = 'record-payment'

            // step 3: record payment to backend
            const paymentResult = await recordPayment({
                chargeId: chargeResult.uuid,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                txHash: hash,
                tokenAddress: PEANUT_WALLET_TOKEN as Address,
                payerAddress: walletAddress as Address,
            })

            pendingSend.clear()
            setPayment(paymentResult)
            setIsSuccess(true)
            setCurrentView('STATUS')

            // Client-leg latency split. Prod DB timing only sees intent
            // creation → POST /payments as one opaque 7.9s-median block
            // (TASK-21147) — this attributes it. Guarded: a capture throw must
            // never route an already-successful payment into the error catch.
            try {
                if (!isDemoMode()) {
                    posthog.capture(ANALYTICS_EVENTS.SEND_LATENCY_BREAKDOWN, {
                        charge_id: chargeResult.uuid,
                        charge_create_ms: tChargeCreated - t0,
                        send_money_ms: tMoneySent - tChargeCreated,
                        record_payment_ms: Date.now() - tMoneySent,
                        total_ms: Date.now() - t0,
                        tx_hash_source: txHashSource,
                    })
                }
            } catch {
                // analytics only — never user-visible
            }
        } catch (err) {
            // The card re-approval prompt was dismissed, or the screen was left,
            // before anything was prepared or signed: no charge was paid and
            // nothing is in flight. Control flow, not a failed send — no error
            // copy on a screen the user may have left, and no Sentry report.
            if (err instanceof SpendRecoveryAbortedError) {
                pendingSend.clear()
                return
            }
            // After the send left the wallet, any failure (a lost answer, a 5xx
            // on recording, a dropped connection) may hide money that moved:
            // recovery answers it, and Send stays off meanwhile.
            const mayHaveSent = pendingSend.mayHaveSent(err)
            if (!mayHaveSent) {
                pendingSend.clear()
                setError({ showError: true, errorMessage: toFriendlyError(err) })
            }

            // Report here, at the flow level, rather than relying on the
            // console-capture integration: everything below this catch either
            // console.errors (which the noise filters then drop) or reports
            // only WebAuthn-named failures to PostHog, so a send that ended in
            // "contact support" left no queryable record anywhere.
            const errorName = err instanceof Error ? err.name : 'unknown'
            // Fire-and-forget: the triage probes may take up to 2.5s and must
            // not hold up `finally` resetting the loading state.
            void captureNetworkTriagedFailure(err, {
                tags: { ...criticalFlowTags('direct-send'), send_step: failedStep, may_have_sent: String(mayHaveSent) },
                extra: {
                    chargeId,
                    recipientAddress: recipient.address,
                    amount,
                    usdAmount,
                    userId: user?.user?.userId,
                },
                analytics: {
                    event: ANALYTICS_EVENTS.SEND_FAILED,
                    props: {
                        step: failedStep,
                        charge_id: chargeId,
                        error_name: errorName,
                    },
                },
            })
            if (mayHaveSent) await pendingSend.recover()
        } finally {
            pendingSend.release()
            setIsLoading(false)
            setLoadingState('Idle')
        }
    }, [
        recipient,
        amount,
        usdAmount,
        attachment,
        walletAddress,
        createCharge,
        sendMoney,
        pendingSend,
        recordPayment,
        setCharge,
        setTxHash,
        setPayment,
        setIsSuccess,
        setCurrentView,
        setError,
        setIsLoading,
        setLoadingState,
        clearError,
        toFriendlyError,
        user,
        t,
    ])

    return {
        // state
        amount,
        usdAmount,
        currentView,
        recipient,
        attachment,
        charge,
        payment,
        txHash,
        error,
        // a pending send keeps Send busy until recovery says it is final
        isLoading: isLoading || isCreatingCharge || isRecording || pendingSend.isPending,
        isSuccess,

        // computed
        canProceed,
        hasSufficientBalance: hasEnoughBalance,
        isInsufficientBalance,
        isLoggedIn,
        isConnected,
        walletAddress,
        formattedBalance: formattedSpendableBalance,
        balanceFillAmount: spendableBalanceDecimal,

        // actions
        setAmount: handleSetAmount,
        setAttachment,
        clearError,
        executePayment,
        resetSendFlow,
        setCurrentView,
    }
}
