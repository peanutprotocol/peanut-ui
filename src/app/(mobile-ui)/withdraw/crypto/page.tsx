'use client'

import ActionModal from '@/components/Global/ActionModal'
import AddressLink from '@/components/Global/AddressLink'
import PeanutLoading from '@/components/Global/PeanutLoading'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import ConfirmWithdrawView from '@/components/Withdraw/views/Confirm.withdraw.view'
import InitialWithdrawView from '@/components/Withdraw/views/Initial.withdraw.view'
import { useWithdrawFlow, type WithdrawData } from '@/context/WithdrawFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import type {
    CreateChargeRequest,
    CreateRequestRequest as CreateRequestPayloadServices,
    TCharge,
    TRequestResponse,
} from '@/services/services.types'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import { isWithdrawFeeDisproportionate, getMinWithdrawUsdForChain } from '@/utils/cross-chain-fee.utils'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { isBelowRhinoMinDeposit } from '@/utils/withdraw.utils'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSafeBack } from '@/hooks/useSafeBack'
import { captureMessage } from '@sentry/nextjs'
import type { Address, Hex, TransactionReceipt } from 'viem'
import { parseUnits } from 'viem'
import { Slider } from '@/components/Slider'
import { tokenSelectorContext } from '@/context'
import { useHaptic } from 'use-haptic'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { ROUTE_NOT_FOUND_ERROR } from '@/constants/general.consts'
import { useCrossChainTransfer } from '@/features/payments/shared/hooks/useCrossChainTransfer'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { isTxReverted } from '@/utils/general.utils'
import { appBaseUrl } from '@/utils/url.utils'
import { ErrorHandler } from '@/utils/friendly-error.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

export default function WithdrawCryptoPage() {
    const router = useRouter()
    const onBack = useSafeBack('/withdraw')
    const { isConnected: isPeanutWallet, address, sendTransactions, sendMoney, spendableBalance } = useWallet()
    const { resetTokenContextProvider } = useContext(tokenSelectorContext)
    const {
        amountToWithdraw,
        usdAmount,
        setAmountToWithdraw,
        currentView,
        setCurrentView,
        withdrawData,
        setWithdrawData,
        showCompatibilityModal,
        setShowCompatibilityModal,
        isPreparingReview,
        setIsPreparingReview,
        paymentError,
        setPaymentError,
        setError: setWithdrawError,
        chargeDetails,
        setChargeDetails,
        setTransactionHash,
        paymentDetails,
        setPaymentDetails,
        resetWithdrawFlow,
    } = useWithdrawFlow()

    // hooks for route calculation and payment recording
    const {
        transactions,
        receiveAmount,
        payAmount,
        feeUsd,
        minDepositLimitUsd,
        isCalculating,
        isXChain,
        isDiffToken,
        error: routeError,
        calculate: calculateRoute,
        reset: resetRouteCalculation,
    } = useCrossChainTransfer()

    const { isRecording, error: recordError, recordPayment, reset: resetPaymentRecorder } = usePaymentRecorder()

    const { triggerHaptic } = useHaptic()

    // local state for transaction execution
    const [isSendingTx, setIsSendingTx] = useState(false)

    // combined processing state
    const isProcessing = useMemo(() => isSendingTx || isRecording, [isSendingTx, isRecording])

    // helper to manage errors consistently
    const setError = useCallback(
        (error: string | null) => {
            setPaymentError(error)
            // also set the withdraw flow error state for display in InitialWithdrawView
            setWithdrawError({
                showError: !!error,
                errorMessage: error || '',
            })
        },
        [setPaymentError, setWithdrawError]
    )

    const clearErrors = useCallback(() => {
        setError(null)
    }, [setError])

    // reset on mount
    useEffect(() => {
        setChargeDetails(null)
        setTransactionHash(null)
        setPaymentDetails(null)
        resetRouteCalculation()
        resetPaymentRecorder()
    }, [setChargeDetails, setTransactionHash, setPaymentDetails, resetRouteCalculation, resetPaymentRecorder])

    // clear errors when amount changes
    useEffect(() => {
        if (amountToWithdraw) {
            clearErrors()
            setChargeDetails(null)
        }
    }, [amountToWithdraw, clearErrors, setChargeDetails])

    // propagate route/record errors
    useEffect(() => {
        const error = routeError || recordError
        if (error) {
            setPaymentError(error)
        }
    }, [routeError, recordError, setPaymentError])

    // prepare transaction when entering confirm view
    useEffect(() => {
        if (currentView === 'CONFIRM' && chargeDetails && withdrawData && address) {
            calculateRoute({
                source: {
                    address: address as Address,
                    tokenAddress: PEANUT_WALLET_TOKEN as Address,
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    // amountToWithdraw is USD-denominated; source token is USDC (1:1).
                    // Required for the bridge path's 'pay' mode (cross-chain ETH/etc).
                    tokenAmount: amountToWithdraw,
                },
                destination: {
                    recipientAddress: chargeDetails.requestLink.recipientAddress as Address,
                    tokenAddress: chargeDetails.tokenAddress as Address,
                    tokenAmount: chargeDetails.tokenAmount,
                    tokenDecimals: chargeDetails.tokenDecimals,
                    tokenType: Number(chargeDetails.tokenType),
                    chainId: chargeDetails.chainId,
                },
                context: 'withdraw',
                contextId: chargeDetails.uuid,
                senderPeanutWalletAddress: address as Address,
                skipGasEstimate: true, // peanut wallet handles gas
            })
        }
    }, [currentView, chargeDetails, withdrawData, calculateRoute, address, amountToWithdraw])

    const handleSetupReview = useCallback(
        async (data: Omit<WithdrawData, 'amount'>) => {
            if (!amountToWithdraw) {
                console.error('Amount to withdraw is not set or not available from context')
                setError('Withdrawal amount is missing.')
                return
            }

            // Same-chain USDC is a direct transfer — no Rhino, no minimum
            // (parity with send-via-link). Every other destination/token rides
            // Rhino, which parks (doesn't auto-refund) deposits below the route
            // minimum — block those before any request/charge is created.
            // amountToWithdraw is USD.
            const isSameChainUsdc =
                data.chain.chainId.toString() === PEANUT_WALLET_CHAIN.id.toString() &&
                data.token.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
            if (!isSameChainUsdc) {
                const usdToWithdraw = parseFloat(amountToWithdraw)
                const minUsd = getMinWithdrawUsdForChain(data.chain.chainId)
                if (!Number.isFinite(usdToWithdraw) || usdToWithdraw < minUsd) {
                    const minDisplay = minUsd % 1 === 0 ? `$${minUsd}` : `$${minUsd.toFixed(2)}`
                    setError(
                        `Withdrawals to ${data.chain.networkName} need at least ${minDisplay}. Increase the amount or pick a different network.`
                    )
                    return
                }
            }

            clearErrors()
            setChargeDetails(null)
            setIsPreparingReview(true)

            try {
                // AmountInput's primary denomination is USD ($), so amountToWithdraw
                // is the USD value the user typed. Convert to destination token
                // units before persisting the request/charge — otherwise meta
                // ends up with `tokenAmount: "1"` + `tokenSymbol: "ETH"` and
                // history renders "1 ETH" for what was actually a $1 withdraw.
                const usdValue = parseFloat(amountToWithdraw)
                const tokenPrice = data.token.price ?? 0
                const destinationTokenAmount =
                    tokenPrice > 0 ? (usdValue / tokenPrice).toFixed(Number(data.token.decimals)) : amountToWithdraw

                const completeWithdrawData = { ...data, amount: destinationTokenAmount }
                setWithdrawData(completeWithdrawData)
                const apiRequestPayload: CreateRequestPayloadServices = {
                    recipientAddress: completeWithdrawData.address,
                    chainId: completeWithdrawData.chain.chainId.toString(),
                    tokenAddress: completeWithdrawData.token.address,
                    tokenType: String(
                        completeWithdrawData.token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                            ? peanutInterfaces.EPeanutLinkType.native
                            : peanutInterfaces.EPeanutLinkType.erc20
                    ),
                    tokenAmount: destinationTokenAmount,
                    tokenDecimals: completeWithdrawData.token.decimals.toString(),
                    tokenSymbol: completeWithdrawData.token.symbol,
                }
                const newRequest: TRequestResponse = await requestsApi.create(apiRequestPayload)

                if (!newRequest || !newRequest.uuid) {
                    throw new Error('Failed to create request for withdrawal.')
                }

                const chargePayload: CreateChargeRequest = {
                    pricing_type: 'fixed_price',
                    local_price: { amount: usdValue.toString(), currency: 'USD' },
                    baseUrl: appBaseUrl(),
                    requestId: newRequest.uuid,
                    requestProps: {
                        chainId: completeWithdrawData.chain.chainId.toString(),
                        tokenAmount: destinationTokenAmount,
                        tokenAddress: completeWithdrawData.token.address,
                        tokenType:
                            completeWithdrawData.token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                                ? peanutInterfaces.EPeanutLinkType.native
                                : peanutInterfaces.EPeanutLinkType.erc20,
                        tokenSymbol: completeWithdrawData.token.symbol,
                        tokenDecimals: Number(completeWithdrawData.token.decimals),
                        recipientAddress: completeWithdrawData.address,
                    },
                    transactionType: 'WITHDRAW',
                }
                const createdCharge: TCharge = await chargesApi.create(chargePayload)

                if (!createdCharge || !createdCharge.data || !createdCharge.data.id) {
                    throw new Error('Failed to create charge for withdrawal or charge ID missing.')
                }

                const fullChargeDetails = await chargesApi.get(createdCharge.data.id)

                setChargeDetails(fullChargeDetails)
                setShowCompatibilityModal(true)
            } catch (err: any) {
                console.error('Error during setup review (request/charge creation):', err)
                const errorMessage = err.message || 'Could not prepare withdrawal. Please try again.'
                setError(errorMessage)
            } finally {
                setIsPreparingReview(false)
            }
        },
        [
            amountToWithdraw,
            clearErrors,
            setChargeDetails,
            setIsPreparingReview,
            setWithdrawData,
            setShowCompatibilityModal,
            setError,
        ]
    )

    const handleCompatibilityProceed = useCallback(() => {
        setShowCompatibilityModal(false)
        if (chargeDetails && withdrawData) {
            setCurrentView('CONFIRM')
        } else {
            console.error('Proceeding to confirm, but charge details or withdraw data are missing.')
            setError('Failed to load withdrawal details for confirmation. Please go back and try again.')
        }
    }, [chargeDetails, withdrawData, setCurrentView, setShowCompatibilityModal, setError])

    // True when the withdraw needs a Rhino path (SDA or bridge swap) rather
    // than a direct USDC transfer. Crosses a chain boundary OR a token
    // boundary — `isCrossChainWithdrawal` historically only checked chains,
    // which silently downgraded cross-token same-chain (USDC → ETH on Arb)
    // to a plain USDC.transfer to the recipient.
    const isCrossChainWithdrawal = useMemo<boolean>(() => {
        if (!withdrawData || !chargeDetails) return false
        return isXChain || isDiffToken
    }, [withdrawData, chargeDetails, isXChain, isDiffToken])

    const handleConfirmWithdrawal = useCallback(async () => {
        if (!chargeDetails || !withdrawData || !amountToWithdraw || !address) {
            console.error('Withdraw data, active charge details, or amount missing for final confirmation')
            setError('Essential withdrawal information is missing.')
            return
        }

        if (!transactions || transactions.length === 0) {
            console.error('No transactions prepared for withdrawal')
            setError('Transaction not prepared. Please try again.')
            return
        }

        clearErrors()
        setIsSendingTx(true)

        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_CONFIRMED, {
            amount_usd: usdAmount,
            method_type: 'crypto',
        })

        try {
            // For same-chain + same-token withdraws, useCrossChainTransfer
            // produces a single `usdc.transfer(recipient, amount)` call. Route
            // through sendMoney instead of sendTransactions so `useSpendBundle`
            // can take the collateral-only path (directTransfer=true straight
            // to the external recipient — no smart-account hop). Cross-chain
            // goes through Rhino SDA on the kernel, so it stays on the
            // sendTransactions mixed path.
            let finalTxHash: Hex | undefined
            let receipt: TransactionReceipt | null = null
            // 'collateral-only' | 'smart-only' | 'mixed' — how the spend was
            // funded; drives how strictly the recordPayment result is treated
            // (see the recordPayment note below).
            let strategy: 'collateral-only' | 'smart-only' | 'mixed' | undefined
            // Backend TransactionIntent id — used to navigate to the unified
            // receipt page for collateral/mixed spends.
            let intentId: string | undefined

            if (!isCrossChainWithdrawal) {
                const {
                    userOpHash,
                    txHash,
                    receipt: r,
                    strategy: s,
                    intentId: i,
                } = await sendMoney(withdrawData.address as Address, amountToWithdraw, {
                    kind: 'CRYPTO_WITHDRAW',
                    // Lets the backend settle the charge directly when the spend
                    // routes through Rain card collateral (collateral-only): the
                    // charge intent becomes the withdrawal preparation and
                    // /submit completes it server-side. Without this the charge
                    // rots PENDING and the successful withdrawal never shows in
                    // Activity (same contract as direct-send / request-pay).
                    chargeId: chargeDetails.uuid,
                })
                receipt = r
                strategy = s
                intentId = i
                if (receipt !== null && isTxReverted(receipt)) {
                    throw new Error(`Transaction failed (reverted). Hash: ${receipt.transactionHash}`)
                }
                finalTxHash = (receipt?.transactionHash as Hex | undefined) ?? userOpHash ?? txHash
            } else {
                // payAmount is the USDC the kernel actually needs on-hand to execute
                // the first tx — principal + Rhino fee on the SDA path (mode='receive'),
                // principal on the bridge path. Passing the principal alone here
                // under-funds the mixed-strategy collateral sweep and the subsequent
                // transfer reverts with `ERC20: transfer amount exceeds balance`.
                const sourceUsdcAmount = payAmount ?? usdAmount.toString()
                const requiredUsdcAmount = parseUnits(sourceUsdcAmount, PEANUT_WALLET_TOKEN_DECIMALS)
                const txResult = await sendTransactions(transactions, {
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    requiredUsdcAmount,
                    kind: 'CRYPTO_WITHDRAW',
                })
                receipt = txResult.receipt
                strategy = txResult.strategy
                intentId = txResult.intentId
                if (receipt !== null && isTxReverted(receipt)) {
                    throw new Error(`Transaction failed (reverted). Hash: ${receipt.transactionHash}`)
                }
                finalTxHash = (receipt?.transactionHash as Hex | undefined) ?? txResult.userOpHash
            }

            if (!finalTxHash) throw new Error('Withdrawal returned no transaction identifier')

            // Record the payment against the charge on EVERY path — completing
            // the user-facing charge is what makes the withdrawal appear in
            // Activity:
            //  - collateral-only: /prepare tagged the charge (chargeId above)
            //    and /submit completed it server-side; recordPayment re-enters
            //    the same trusted-completion path (idempotent) — the designed
            //    recovery net when /submit's post-mining bookkeeping fails.
            //  - mixed: the kernel sent a plain usdc.transfer(recipient) that
            //    the on-chain validator matches — the normal recordPayment path.
            //  - smart-only / cross-chain: unchanged — recordPayment has always
            //    been their only charge-completion trigger.
            // This used to be SKIPPED for collateral-routed same-chain
            // withdraws, which left the charge PENDING forever: history hides
            // never-paid charges as abandoned drafts and hides the rain-prepare
            // intent as a phantom, so a successful withdrawal was completely
            // invisible in Activity while the balance dropped.
            const routedThroughCollateral = strategy === 'collateral-only' || strategy === 'mixed'
            const collateralRoutedSameChain = routedThroughCollateral && !isCrossChainWithdrawal

            // An untagged mixed same-chain charge goes through the on-chain
            // validator, which needs a MINED tx hash — a userOp hash can never
            // match, and validator retry-exhaustion would flip the successful
            // withdrawal to FAILED (worse than the pre-fix stuck-PENDING). If
            // the receipt wait timed out, skip the record (pre-fix behavior)
            // and leave a breadcrumb. collateral-only is safe regardless: its
            // hash is a backend-broadcast EVM tx and the tagged charge settles
            // via the trusted path.
            const mixedWithoutMinedHash = strategy === 'mixed' && !isCrossChainWithdrawal && !receipt?.transactionHash

            let payment: Awaited<ReturnType<typeof recordPayment>> | null = null
            if (mixedWithoutMinedHash) {
                captureMessage('withdraw: skipping recordPayment — mixed spend without mined receipt', {
                    level: 'warning',
                    extra: { chargeId: chargeDetails.uuid, userOpOrTxHash: finalTxHash, strategy },
                })
            } else {
                try {
                    payment = await recordPayment({
                        chargeId: chargeDetails.uuid,
                        chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        txHash: finalTxHash,
                        tokenAddress: PEANUT_WALLET_TOKEN as Address,
                        payerAddress: address as Address,
                    })
                } catch (err) {
                    // Funds already moved on-chain. On collateral-routed same-chain
                    // paths a recordPayment hiccup must not read as a failed
                    // withdrawal (collateral-only is already settled server-side;
                    // mixed then just stays PENDING, exactly like pre-fix) —
                    // degrade to the success view without payment details. Other
                    // paths keep throwing, as they always have.
                    if (!collateralRoutedSameChain) throw err
                    console.error('recordPayment failed after collateral-routed withdrawal (funds moved):', err)
                    captureMessage('withdraw: recordPayment failed after collateral-routed spend', {
                        level: 'warning',
                        extra: { chargeId: chargeDetails.uuid, txHash: finalTxHash, strategy },
                    })
                }
            }

            setTransactionHash(finalTxHash)
            setPaymentDetails(payment)
            triggerHaptic()
            setCurrentView('STATUS')
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_COMPLETED, {
                amount_usd: usdAmount,
                method_type: 'crypto',
            })
        } catch (err) {
            console.error('Withdrawal execution failed:', err)
            const errMsg = ErrorHandler(err)
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                method_type: 'crypto',
                error_message: errMsg,
            })
            setError(errMsg)
        } finally {
            setIsSendingTx(false)
        }
    }, [
        chargeDetails,
        withdrawData,
        amountToWithdraw,
        address,
        transactions,
        payAmount,
        usdAmount,
        sendTransactions,
        sendMoney,
        isCrossChainWithdrawal,
        recordPayment,
        setCurrentView,
        setTransactionHash,
        setPaymentDetails,
        clearErrors,
        setError,
        triggerHaptic,
    ])

    const handleBackFromConfirm = useCallback(() => {
        setCurrentView('INITIAL')
        clearErrors()
        setChargeDetails(null)
    }, [setCurrentView, clearErrors, setChargeDetails])

    // reset withdraw flow when this component unmounts. Resetting on unmount (rather
    // than in the success view's onComplete) avoids a race: a synchronous reset clears
    // amountToWithdraw and flips currentView off STATUS, which re-triggers the guard
    // below and pushes '/withdraw' over the '/home' navigation from "Back to home".
    useEffect(() => {
        return () => {
            resetRouteCalculation()
            resetPaymentRecorder()
            resetTokenContextProvider() // reset token selector context to make sure previously selected token is not cached
            resetWithdrawFlow()
        }
    }, [resetRouteCalculation, resetPaymentRecorder, resetTokenContextProvider, resetWithdrawFlow])

    // Display payment errors first (user actions), then route errors (system limitations)
    const displayError = paymentError

    // Get network fee from Rhino preview. Under SDA the fee is a transparent
    // bridge-fee in USD — no slippage distinction.
    const networkFee = useMemo<number>(() => feeUsd ?? 0, [feeUsd])

    // Non-blocking heads-up when the bridge fee is a large share of the amount
    // (flat mainnet gas dominating a small withdraw). The user can still proceed
    // — the fee is shown honestly; we just flag it so a tiny mainnet withdrawal
    // isn't a silent footgun. See cross-chain-fee.utils.ts.
    const showHighFeeWarning = useMemo<boolean>(
        () => isCrossChainWithdrawal && isWithdrawFeeDisproportionate(networkFee, parseFloat(usdAmount)),
        [isCrossChainWithdrawal, networkFee, usdAmount]
    )

    // Pre-sign affordability gate for cross-chain. The input-time gate only
    // checked the principal, but the kernel must spend principal + bridge fee
    // (`payAmount`), so a withdraw that fit the balance at input can fall short
    // here once the fee is known — and the send would surface the misleading
    // "balance isn't fully available yet" (settling) error instead of an honest
    // "not enough balance". Block it here with the right message. Only once the
    // quote has resolved `payAmount` (skipped while calculating; CTA is disabled
    // by isCalculating anyway).
    const insufficientForFee = useMemo<boolean>(
        () =>
            isCrossChainWithdrawal &&
            payAmount != null &&
            spendableBalance !== undefined &&
            !isAmountWithinBalance(payAmount, spendableBalance),
        [isCrossChainWithdrawal, payAmount, spendableBalance]
    )

    // Rhino accepts SDA deposits below the route minimum on-chain but never
    // bridges them — funds strand at the SDA, uncredited. Block the CTA before
    // the user signs. Same-chain USDC transfers have no minimum.
    const belowMinimumMessage = useMemo<string | null>(
        () =>
            isCrossChainWithdrawal && isBelowRhinoMinDeposit(payAmount, minDepositLimitUsd)
                ? `The minimum withdrawal to this network is $${minDepositLimitUsd}. Enter a larger amount.`
                : null,
        [isCrossChainWithdrawal, payAmount, minDepositLimitUsd]
    )

    if (!amountToWithdraw && currentView !== 'STATUS') {
        // Redirect to main withdraw page for amount input
        // Guard against STATUS view: resetWithdrawFlow() clears amountToWithdraw,
        // which would override the router.push('/home') in handleDone
        router.push('/withdraw')
        return <PeanutLoading />
    }

    return (
        <div className="mx-auto min-h-[inherit] w-full max-w-md space-y-4 self-center">
            {currentView === 'INITIAL' && (
                <InitialWithdrawView
                    amount={usdAmount}
                    onReview={handleSetupReview}
                    onBack={onBack}
                    isProcessing={isPreparingReview}
                />
            )}

            {currentView === 'CONFIRM' && withdrawData && chargeDetails && (
                <ConfirmWithdrawView
                    amount={usdAmount}
                    token={withdrawData.token}
                    chain={withdrawData.chain}
                    toAddress={withdrawData.address}
                    onConfirm={handleConfirmWithdrawal}
                    onBack={handleBackFromConfirm}
                    isProcessing={isProcessing}
                    error={displayError}
                    networkFee={networkFee}
                    isCrossChain={isCrossChainWithdrawal}
                    isCalculating={isCalculating}
                    receiveAmount={receiveAmount}
                    payAmount={payAmount}
                    showHighFeeWarning={showHighFeeWarning}
                    insufficientBalance={insufficientForFee}
                    belowMinimumMessage={belowMinimumMessage}
                />
            )}

            {currentView === 'STATUS' && withdrawData && chargeDetails && (
                <>
                    <PaymentSuccessView
                        headerTitle="Withdraw"
                        recipientType="ADDRESS"
                        type="SEND"
                        amount={usdAmount}
                        isWithdrawFlow={true}
                        redirectTo="/home"
                        chargeDetails={chargeDetails}
                        paymentDetails={paymentDetails}
                        usdAmount={usdAmount}
                        message={
                            <AddressLink
                                className="text-sm font-normal text-grey-1 no-underline"
                                address={withdrawData.address}
                            />
                        }
                    />
                </>
            )}

            <ActionModal
                visible={showCompatibilityModal}
                onClose={() => {
                    if (isPreparingReview) return
                    setShowCompatibilityModal(false)
                }}
                preventClose={isPreparingReview}
                title="Is this address compatible?"
                description="Only send to address that support the selected network and token. Incorrect transfers may be lost."
                icon="alert"
                footer={
                    <div className="w-full">
                        <Slider
                            onValueChange={(v: boolean) => {
                                if (!v) return
                                handleCompatibilityProceed()
                            }}
                        />
                    </div>
                }
            />
        </div>
    )
}
