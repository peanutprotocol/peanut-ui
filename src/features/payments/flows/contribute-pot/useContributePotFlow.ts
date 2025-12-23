'use client'

/**
 * hook for contribute pot flow
 *
 * handles the full payment lifecycle for request pot contributions:
 * 1. validates amount and checks balance
 * 2. creates a charge in backend
 * 3. sends payment via peanut wallet
 * 4. records the payment to backend
 *
 * also provides smart defaults for the contribution slider
 * based on existing contributions (e.g. suggests 1/3 for split bills)
 */

import { useCallback, useMemo } from 'react'
import { type Address, type Hash } from 'viem'
import { useContributePotFlowContext } from './ContributePotFlowContext'
import { useChargeManager } from '@/features/payments/shared/hooks/useChargeManager'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAuth } from '@/context/authContext'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { ErrorHandler } from '@/utils/sdkErrorHandler.utils'

export function useContributePotFlow() {
    const {
        amount,
        setAmount,
        usdAmount,
        setUsdAmount,
        currentView,
        setCurrentView,
        request,
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
        totalAmount,
        totalCollected,
        contributors,
        resetContributePotFlow,
    } = useContributePotFlowContext()

    const { user } = useAuth()
    const { createCharge, isCreating: isCreatingCharge } = useChargeManager()
    const { recordPayment, isRecording } = usePaymentRecorder()
    const {
        isConnected,
        address: walletAddress,
        sendMoney,
        formattedBalance,
        hasSufficientBalance,
        isFetchingBalance,
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
        if (!amount || !recipient || !request) return false
        const amountNum = parseFloat(amount)
        if (isNaN(amountNum) || amountNum <= 0) return false
        return true
    }, [amount, recipient, request])

    // check if has sufficient balance for current amount
    const hasEnoughBalance = useMemo(() => {
        if (!amount) return false
        return hasSufficientBalance(amount)
    }, [amount, hasSufficientBalance])

    // check if should show insufficient balance error
    // only show after balance has loaded to avoid flash of error on initial render
    const isInsufficientBalance = useMemo(() => {
        return (
            isLoggedIn &&
            !!amount &&
            !hasEnoughBalance &&
            !isLoading &&
            !isCreatingCharge &&
            !isRecording &&
            !isFetchingBalance
        )
    }, [isLoggedIn, amount, hasEnoughBalance, isLoading, isCreatingCharge, isRecording, isFetchingBalance])

    // calculate default slider value and suggested amount
    const sliderDefaults = useMemo(() => {
        if (totalAmount <= 0) return { percentage: 0, suggestedAmount: 0 }

        // no contributions yet - suggest 100% (full pot)
        if (contributors.length === 0) {
            return { percentage: 100, suggestedAmount: totalAmount }
        }

        // calculate based on existing contributions
        const contributionAmounts = contributors.map((c) => parseFloat(c.amount)).filter((a) => !isNaN(a) && a > 0)

        if (contributionAmounts.length === 0) return { percentage: 0, suggestedAmount: 0 }

        // check if this is an equal-split pattern
        const collectedPercentage = (totalCollected / totalAmount) * 100
        const isOneThirdCollected = Math.abs(collectedPercentage - 100 / 3) < 2
        const isTwoThirdsCollected = Math.abs(collectedPercentage - 200 / 3) < 2

        if (isOneThirdCollected || isTwoThirdsCollected) {
            const exactThird = 100 / 3
            return { percentage: exactThird, suggestedAmount: totalAmount * (exactThird / 100) }
        }

        // suggest median contribution
        const sortedAmounts = [...contributionAmounts].sort((a, b) => a - b)
        const midIndex = Math.floor(sortedAmounts.length / 2)
        const suggestedAmount =
            sortedAmounts.length % 2 === 0
                ? (sortedAmounts[midIndex - 1] + sortedAmounts[midIndex]) / 2
                : sortedAmounts[midIndex]

        const percentage = Math.min((suggestedAmount / totalAmount) * 100, 100)
        return { percentage, suggestedAmount }
    }, [totalAmount, totalCollected, contributors])

    // execute the contribution
    const executeContribution = useCallback(async () => {
        if (!recipient || !amount || !walletAddress || !request) {
            setError({ showError: true, errorMessage: 'missing required data' })
            return
        }

        setIsLoading(true)
        clearError()

        try {
            // step 1: create charge for this contribution
            const chargeResult = await createCharge({
                tokenAmount: amount,
                tokenAddress: PEANUT_WALLET_TOKEN as Address,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                tokenSymbol: 'USDC',
                tokenDecimals: PEANUT_WALLET_TOKEN_DECIMALS,
                recipientAddress: recipient.address,
                transactionType: 'REQUEST',
                requestId: request.uuid,
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
        request,
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
        request,
        recipient,
        attachment,
        charge,
        payment,
        txHash,
        error,
        isLoading: isLoading || isCreatingCharge || isRecording,
        isSuccess,

        // derived data
        totalAmount,
        totalCollected,
        contributors,
        sliderDefaults,

        // computed
        canProceed,
        hasSufficientBalance: hasEnoughBalance,
        isInsufficientBalance,
        isLoggedIn,
        isConnected,
        walletAddress,
        formattedBalance,

        // actions
        setAmount: handleSetAmount,
        setAttachment,
        clearError,
        executeContribution,
        resetContributePotFlow,
        setCurrentView,
    }
}
