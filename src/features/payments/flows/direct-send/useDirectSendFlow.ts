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

import { useCallback, useMemo } from 'react'
import { type Address, type Hash } from 'viem'
import { useDirectSendFlowContext } from './DirectSendFlowContext'
import { useChargeManager } from '@/features/payments/shared/hooks/useChargeManager'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAuth } from '@/context/authContext'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useTranslations } from 'next-intl'

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
        clearError()

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
            const hash = (txResult.receipt?.transactionHash ?? txResult.userOpHash ?? txResult.txHash) as Hash

            setTxHash(hash)

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
        } catch (err) {
            const errorMessage = toFriendlyError(err)
            setError({ showError: true, errorMessage })
        } finally {
            setIsLoading(false)
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
        clearError,
        toFriendlyError,
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
