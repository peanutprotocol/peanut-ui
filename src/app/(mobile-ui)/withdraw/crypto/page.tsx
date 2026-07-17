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
import { isWithdrawFeeDisproportionate } from '@/utils/cross-chain-fee.utils'
import { isAmountWithinBalance } from '@/utils/balance.utils'
import { isBelowRhinoMinDeposit } from '@/utils/withdraw.utils'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSafeBack } from '@/hooks/useSafeBack'
import type { Address, Hex, TransactionReceipt } from 'viem'
import { parseUnits } from 'viem'
import { Slider } from '@/components/Slider'
import { tokenSelectorContext } from '@/context'
import { useHaptic } from 'use-haptic'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useCrossChainTransfer } from '@/features/payments/shared/hooks/useCrossChainTransfer'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { isTxReverted } from '@/utils/general.utils'
import { appBaseUrl } from '@/utils/url.utils'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'

export default function WithdrawCryptoPage() {
    const router = useRouter()
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const toFriendlyError = useFriendlyError()
    const onBack = useSafeBack('/withdraw')
    const { address, sendTransactions, sendMoney, spendableBalance } = useWallet()
    const { resetTokenContextProvider } = useContext(tokenSelectorContext)
    const {
        amountToWithdraw,
        usdAmount,
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
                setError(t('errors.amountMissing'))
                return
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
                    throw new Error(t('errors.requestFailed'))
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
                    throw new Error(t('errors.chargeFailed'))
                }

                const fullChargeDetails = await chargesApi.get(createdCharge.data.id)

                setChargeDetails(fullChargeDetails)
                setShowCompatibilityModal(true)
            } catch (err: any) {
                console.error('Error during setup review (request/charge creation):', err)
                const errorMessage = err.message || t('errors.prepareFailed')
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
            t,
        ]
    )

    const handleCompatibilityProceed = useCallback(() => {
        setShowCompatibilityModal(false)
        if (chargeDetails && withdrawData) {
            setCurrentView('CONFIRM')
        } else {
            console.error('Proceeding to confirm, but charge details or withdraw data are missing.')
            setError(t('errors.confirmDetailsFailed'))
        }
    }, [chargeDetails, withdrawData, setCurrentView, setShowCompatibilityModal, setError, t])

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
            setError(t('errors.essentialInfoMissing'))
            return
        }

        if (!transactions || transactions.length === 0) {
            console.error('No transactions prepared for withdrawal')
            setError(t('errors.txNotPrepared'))
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
            // 'collateral-only' | 'smart-only' | 'mixed' — drives whether we call
            // recordPayment (smart-only) or rely on the Rain webhook →
            // TransactionIntent reconciliation path (collateral-only / mixed).
            let strategy: 'collateral-only' | 'smart-only' | 'mixed' | undefined

            if (!isCrossChainWithdrawal) {
                const {
                    userOpHash,
                    txHash,
                    receipt: r,
                    strategy: s,
                } = await sendMoney(withdrawData.address as Address, amountToWithdraw, { kind: 'CRYPTO_WITHDRAW' })
                receipt = r
                strategy = s
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
                if (receipt !== null && isTxReverted(receipt)) {
                    throw new Error(`Transaction failed (reverted). Hash: ${receipt.transactionHash}`)
                }
                finalTxHash = (receipt?.transactionHash as Hex | undefined) ?? txResult.userOpHash
            }

            if (!finalTxHash) throw new Error('Withdrawal returned no transaction identifier')

            // Skip recordPayment when funds moved via Rain collateral on a
            // SAME-chain withdrawal — the charge indexer watches for
            // smart-account-outgoing transfers, but a coordinator-driven
            // withdraw moves USDC from the collateral proxy and would leave
            // the Charge unmatched ("failed" in history). The Rain webhook +
            // TransactionIntent reconciliation is the source of truth there.
            //
            // Cross-chain withdraws ALWAYS need recordPayment to fire — the
            // BE validator's cross-chain branch transitions the charge intent
            // to COMPLETED directly (trusts the source-chain submission since
            // Rhino owns delivery downstream). Without this call the intent
            // gets stuck at PENDING because nothing else triggers the
            // transition for the bridge-path (depositWithId, mode='pay')
            // flow we use for non-stable destinations.
            const routedThroughCollateral = strategy === 'collateral-only' || strategy === 'mixed'
            const skipRecordPayment = routedThroughCollateral && !isCrossChainWithdrawal

            let payment: Awaited<ReturnType<typeof recordPayment>> | null = null
            if (!skipRecordPayment) {
                payment = await recordPayment({
                    chargeId: chargeDetails.uuid,
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    txHash: finalTxHash,
                    tokenAddress: PEANUT_WALLET_TOKEN as Address,
                    payerAddress: address as Address,
                })
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
            const errMsg = toFriendlyError(err)
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
        t,
        toFriendlyError,
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
                        headerTitle={tNav('withdraw')}
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
                title={t('compatibilityModal.title')}
                description={t('compatibilityModal.description')}
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
