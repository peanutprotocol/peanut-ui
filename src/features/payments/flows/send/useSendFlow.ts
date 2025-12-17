'use client'

// orchestrator hook for send flow
// coordinates charge creation, transaction sending, and payment recording

import { useCallback, useMemo } from 'react'
import { type Address, type Hash } from 'viem'
import { useSendFlowContext } from './SendFlowContext'
import { useChargeManager } from '@/features/payments/shared/hooks/useChargeManager'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { useWallet } from '@/hooks/wallet/useWallet'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { ErrorHandler } from '@/utils/sdkErrorHandler.utils'

export function useSendFlow() {
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
    } = useSendFlowContext()

    const { createCharge, isCreating: isCreatingCharge } = useChargeManager()
    const { recordPayment, isRecording } = usePaymentRecorder()
    const { isConnected, address: walletAddress, sendMoney, formattedBalance, hasSufficientBalance } = useWallet()

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

    // execute the payment (called from input view)
    const executePayment = useCallback(async () => {
        if (!recipient || !amount || !walletAddress) {
            setError({ showError: true, errorMessage: 'missing required data' })
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
            const txResult = await sendMoney(recipient.address, amount)
            const hash = (txResult.receipt?.transactionHash ?? txResult.userOpHash) as Hash

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
            const errorMessage = ErrorHandler(err)
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
        isConnected,
        walletAddress,
        formattedBalance,

        // actions
        setAmount: handleSetAmount,
        setAttachment,
        clearError,
        executePayment,
        resetSendFlow,
        setCurrentView,
    }
}
