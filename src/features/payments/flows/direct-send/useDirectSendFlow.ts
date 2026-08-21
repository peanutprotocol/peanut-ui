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
import { useChargeManager } from '@/features/payments/shared/hooks/useChargeManager'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAuth } from '@/context/authContext'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useTranslations } from 'next-intl'
import { captureException } from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { resolveSettledTxHash } from '@/utils/settled-tx-hash.utils'

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
        hasSufficientSpendableBalance: hasSufficientBalance,
        isFetchingSpendableBalance,
    } = useWallet()

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

        setIsLoading(true)
        setLoadingState('Loading')
        clearError()

        let failedStep: 'create-charge' | 'send-money' | 'record-payment' = 'create-charge'
        let chargeId: string | undefined
        const t0 = Date.now()
        let tChargeCreated = 0
        let tMoneySent = 0

        try {
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
            tChargeCreated = Date.now()
            failedStep = 'send-money'

            // step 2: send money via peanut wallet
            const txResult = await sendMoney(recipient.address, amount, {
                kind: 'P2P_SEND',
                // Lets the backend settle the charge directly when the spend routes
                // through Rain card collateral (the on-chain validator can't verify
                // a collateral-contract tx). recordPayment below is then routed
                // through the same trusted-completion path.
                chargeId: chargeResult.uuid,
            })
            // For the collateral-only strategy useSpendBundle returns only
            // `txHash` (Rain coordinator submits the on-chain tx; no UserOp
            // hash + no receipt land here). Fall back to it so users with
            // card collateral can pay without smart-account balance.
            const { hash, source: txHashSource } = resolveSettledTxHash(txResult, 'direct-send')
            tMoneySent = Date.now()

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

            setPayment(paymentResult)
            setIsSuccess(true)
            setCurrentView('STATUS')

            // Client-leg latency split. Prod DB timing only sees intent
            // creation → POST /payments as one opaque 7.9s-median block
            // (TASK-21147) — this attributes it.
            posthog.capture(ANALYTICS_EVENTS.SEND_LATENCY_BREAKDOWN, {
                charge_id: chargeResult.uuid,
                charge_create_ms: tChargeCreated - t0,
                send_money_ms: tMoneySent - tChargeCreated,
                record_payment_ms: Date.now() - tMoneySent,
                total_ms: Date.now() - t0,
                tx_hash_source: txHashSource,
            })
        } catch (err) {
            const errorMessage = toFriendlyError(err)
            setError({ showError: true, errorMessage })

            // Report here, at the flow level, rather than relying on the
            // console-capture integration: everything below this catch either
            // console.errors (which the noise filters then drop) or reports
            // only WebAuthn-named failures to PostHog, so a send that ended in
            // "contact support" left no queryable record anywhere.
            const errorName = err instanceof Error ? err.name : 'unknown'
            posthog.capture(ANALYTICS_EVENTS.SEND_FAILED, {
                step: failedStep,
                charge_id: chargeId,
                error_name: errorName,
            })
            captureException(err, {
                tags: { ...criticalFlowTags('direct-send'), send_step: failedStep },
                extra: {
                    chargeId,
                    recipientAddress: recipient.address,
                    amount,
                    usdAmount,
                    userId: user?.user?.userId,
                },
            })
        } finally {
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
        isLoading: isLoading || isCreatingCharge || isRecording,
        isSuccess,

        // computed
        canProceed,
        hasSufficientBalance: hasEnoughBalance,
        isInsufficientBalance,
        isLoggedIn,
        isConnected,
        walletAddress,
        formattedBalance: formattedSpendableBalance,

        // actions
        setAmount: handleSetAmount,
        setAttachment,
        clearError,
        executePayment,
        resetSendFlow,
        setCurrentView,
    }
}
