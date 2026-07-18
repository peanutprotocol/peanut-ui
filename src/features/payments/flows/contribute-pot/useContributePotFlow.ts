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
import { ErrorHandler } from '@/utils/friendly-error.utils'

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
        isExternalWalletPayment,
        setIsExternalWalletPayment,
    } = useContributePotFlowContext()

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

    // check if should show insufficient balance error.
    // gate on !isFetchingSpendableBalance so we wait for both smart-account
    // and Rain collateral to settle. See useSemanticRequestFlow for the
    // same fix + reasoning (TASK-19573).
    const isInsufficientBalance = useMemo(() => {
        return (
            isLoggedIn &&
            !!amount &&
            !hasEnoughBalance &&
            !isLoading &&
            !isCreatingCharge &&
            !isRecording &&
            !isFetchingSpendableBalance
        )
    }, [isLoggedIn, amount, hasEnoughBalance, isLoading, isCreatingCharge, isRecording, isFetchingSpendableBalance])

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
    const executeContribution = useCallback(
        async (
            shouldReturnAfterCreatingCharge: boolean = false,
            bypassLoginCheck: boolean = false
        ): Promise<{ success: boolean }> => {
            if (!recipient || !amount || !request) {
                setError({ showError: true, errorMessage: 'missing required data' })
                return { success: false }
            }

            if (!bypassLoginCheck && !walletAddress) {
                setError({ showError: true, errorMessage: 'Please login to continue' })
                return { success: false }
            }

            // Post-on-chain safety gate: once sendMoney has set txHash on
            // the flow context, do NOT re-run this handler — re-firing
            // sendMoney would produce a second on-chain tx attributed to
            // the same charge (Sentry PEANUT-UI-QH9, 2026-06-01). Returning
            // success=false is critical: the external-wallet branch in the
            // input view conditions setCurrentView('EXTERNAL_WALLET') on
            // res.success, so a fake-success short-circuit would mis-route
            // a user who already paid via Peanut wallet into the external-
            // wallet flow for the same pot contribution.
            if (txHash) return { success: false }

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

                // Return early after creating charge if requested, used in external wallet flow.
                if (shouldReturnAfterCreatingCharge) {
                    setIsLoading(false)
                    return { success: true }
                }

                // step 2: send money via peanut wallet
                const txResult = await sendMoney(recipient.address, amount, {
                    kind: 'REQUEST_PAY',
                    // Lets the backend settle the charge directly when the spend
                    // routes through Rain card collateral (the on-chain validator
                    // can't verify a collateral-contract tx). recordPayment below is
                    // then routed through the same trusted-completion path.
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
                setIsLoading(false)
                return { success: true }
            } catch (err) {
                const errorMessage = ErrorHandler(err)
                setError({ showError: true, errorMessage })
                setIsLoading(false)
                return { success: false }
            }
        },
        [
            recipient,
            amount,
            usdAmount,
            attachment,
            walletAddress,
            request,
            createCharge,
            sendMoney,
            recordPayment,
            txHash,
            setCharge,
            setTxHash,
            setPayment,
            setIsSuccess,
            setCurrentView,
            setError,
            setIsLoading,
            clearError,
        ]
    )

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
        // txHash is the post-on-chain gate — truthy iff sendMoney already
        // fired. Consumers MUST disable pay buttons (Peanut wallet AND
        // external wallet) when set; re-running would double-pay. Lives on
        // flow context so the gate survives view transitions.
        txHash,
        error,
        isLoading: isLoading || isCreatingCharge || isRecording,
        isSuccess,
        isExternalWalletPayment,

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
        formattedBalance: formattedSpendableBalance,

        // actions
        setAmount: handleSetAmount,
        setAttachment,
        clearError,
        executeContribution,
        resetContributePotFlow,
        setCurrentView,
        setIsExternalWalletPayment,
    }
}
