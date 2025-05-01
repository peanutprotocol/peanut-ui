'use client'

import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import { useCreateLink } from '@/components/Create/useCreateLink'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FlowHeader from '@/components/Global/FlowHeader'
import PeanutSponsored from '@/components/Global/PeanutSponsored'
import PintaReqViewWrapper from '@/components/PintaReqPay/PintaReqViewWrapper'
import UserCard from '@/components/User/UserCard'
import { tokenSelectorContext } from '@/context'
import { usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import { useWallet } from '@/hooks/wallet/useWallet'
import { getReadableChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore, useWalletStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { areEvmAddressesEqual, formatAmount } from '@/utils'
import { useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { PaymentInfoRow } from '../PaymentInfoRow'

export default function ConfirmPaymentView({ isPintaReq = false }: { isPintaReq?: boolean }) {
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const chargeIdFromUrl = searchParams.get('chargeId')
    const { chargeDetails, parsedPaymentData, beerQuantity } = usePaymentStore()
    const {
        initiatePayment,
        isProcessing,
        loadingStep,
        error: paymentError,
        txFee,
        slippagePercentage,
        estimatedFromValue,
        xChainUnsignedTxs,
        unsignedTx,
    } = usePaymentInitiator()
    const { selectedTokenData, selectedChainID, isXChain, selectedTokenAddress } = useContext(tokenSelectorContext)
    const { isConnected: isPeanutWallet } = useWallet()
    const [isFeeEstimationError, setIsFeeEstimationError] = useState<boolean>(false)
    const { isConnected: isWagmiConnected } = useAccount()
    const [isCalculatingFees, setIsCalculatingFees] = useState(false)
    const [isEstimatingGas, setIsEstimatingGas] = useState(false)
    const { estimateGasFee } = useCreateLink()

    console.log('isFeeEstimationError   ', isFeeEstimationError)

    const [estimatedGasCost, setEstimatedGasCost] = useState<number | undefined>(undefined)
    const [feeOptions, setFeeOptions] = useState<any | undefined>(undefined)
    const { rewardWalletBalance } = useWalletStore()

    const isConnected = useMemo(() => isPeanutWallet || isWagmiConnected, [isPeanutWallet, isWagmiConnected])
    const isInsufficientRewardsBalance = useMemo(() => {
        if (!isPintaReq) return false
        return Number(rewardWalletBalance) < beerQuantity
    }, [isPintaReq, rewardWalletBalance, beerQuantity])
    const diffTokens = useMemo<boolean>(() => {
        if (!selectedTokenData || !chargeDetails) return false
        return !areEvmAddressesEqual(selectedTokenData.address, chargeDetails.tokenAddress)
    }, [selectedTokenData, chargeDetails])
    const calculatedSlippage = useMemo(() => {
        if (!selectedTokenData?.price || !slippagePercentage || !estimatedFromValue) return null

        const slippageAmount = (slippagePercentage / 100) * selectedTokenData.price * Number(estimatedFromValue)

        return isNaN(slippageAmount) ? null : slippageAmount.toFixed(2)
    }, [slippagePercentage, selectedTokenData?.price, estimatedFromValue])

    // estimate gas fee when unsignedTx is ready
    useEffect(() => {
        if (!chargeDetails || (!unsignedTx && !xChainUnsignedTxs)) return

        setIsEstimatingGas(true)
        estimateGasFee({
            chainId: isXChain ? selectedChainID : chargeDetails.chainId,
            preparedTx: isXChain || diffTokens ? xChainUnsignedTxs : unsignedTx,
        })
            .then(({ transactionCostUSD, feeOptions: calculatedFeeOptions }) => {
                if (transactionCostUSD) setEstimatedGasCost(transactionCostUSD)
                if (calculatedFeeOptions) setFeeOptions(calculatedFeeOptions)
            })
            .catch((error) => {
                console.error('Error calculating transaction cost:', error)
                setIsFeeEstimationError(true)
                dispatch(paymentActions.setError('Failed to estimate gas fee'))
            })
            .finally(() => {
                setIsEstimatingGas(false)
            })
    }, [unsignedTx, xChainUnsignedTxs, chargeDetails, isXChain, selectedChainID, selectedTokenAddress, diffTokens])

    // calculate fee details
    const [feeCalculations, setFeeCalculations] = useState({
        networkFee: { expected: '0.00', max: '0.00' },
        slippage: undefined as { expected: string; max: string } | undefined,
        estimatedFee: '0.00',
        totalMax: '0.00',
    })

    useEffect(() => {
        const EXPECTED_NETWORK_FEE_MULTIPLIER = 0.7
        const EXPECTED_SLIPPAGE_MULTIPLIER = 0.1
        setIsCalculatingFees(true)

        try {
            const networkFee = {
                expected:
                    (isXChain || diffTokens
                        ? parseFloat(txFee) * EXPECTED_NETWORK_FEE_MULTIPLIER
                        : isPeanutWallet
                          ? 0
                          : Number(estimatedGasCost || 0)) * EXPECTED_NETWORK_FEE_MULTIPLIER,
                max: isXChain || diffTokens ? parseFloat(txFee) : isPeanutWallet ? 0 : Number(estimatedGasCost || 0),
            }

            const slippage =
                (isXChain || diffTokens) && calculatedSlippage
                    ? {
                          expected: Number(calculatedSlippage) * EXPECTED_SLIPPAGE_MULTIPLIER,
                          max: Number(calculatedSlippage),
                      }
                    : undefined

            const totalMax =
                Number(estimatedFromValue) * selectedTokenData!.price + networkFee.max + (slippage?.max || 0)

            const formatNumberSafely = (num: number) => {
                if (isNaN(num) || !isFinite(num)) return '0.00'
                return num < 0.01 && num > 0 ? '0.01' : num.toFixed(2)
            }

            setFeeCalculations({
                networkFee: {
                    expected: formatNumberSafely(networkFee.expected),
                    max: formatNumberSafely(networkFee.max),
                },
                slippage: slippage
                    ? {
                          expected: formatNumberSafely(slippage.expected),
                          max: formatNumberSafely(slippage.max),
                      }
                    : undefined,
                estimatedFee: formatNumberSafely(networkFee.expected + (slippage?.expected || 0)),
                totalMax: formatNumberSafely(totalMax),
            })

            const timer = setTimeout(() => {
                setIsCalculatingFees(false)
            }, 300)
            return () => clearTimeout(timer)
        } catch (error) {
            console.error('Error calculating fees:', error)
            setIsFeeEstimationError(true)
            setIsCalculatingFees(false)
            setFeeCalculations({
                networkFee: { expected: '0.00', max: '0.00' },
                slippage: undefined,
                estimatedFee: '0.00',
                totalMax: '0.00',
            })
        }
    }, [
        isXChain,
        txFee,
        calculatedSlippage,
        chargeDetails,
        selectedTokenData,
        isPeanutWallet,
        estimatedGasCost,
        estimatedFromValue,
        selectedTokenData,
        diffTokens,
    ])

    // handle payment confirmation
    const handlePayment = useCallback(async () => {
        if (!chargeDetails || !parsedPaymentData) return

        // for PINTA requests, validate beer quantity
        if (isPintaReq && beerQuantity <= 0) {
            dispatch(paymentActions.setError('Please select at least 1 beer to continue.'))
            return
        }

        // use existing charge details
        const result = await initiatePayment({
            recipient: parsedPaymentData.recipient,
            tokenAmount: isPintaReq ? beerQuantity.toString() : chargeDetails.tokenAmount,
            isPintaReq: isPintaReq,
            chargeId: chargeDetails.uuid,
            skipChargeCreation: true, // always skip charge creation in confirmation view
        })

        if (result.success) {
            dispatch(paymentActions.setView('STATUS'))
        }
    }, [chargeDetails, initiatePayment, parsedPaymentData, dispatch, isPintaReq, beerQuantity])

    // get button text based on state
    const getButtonText = useCallback(() => {
        if (isProcessing) {
            return loadingStep === 'Idle' ? 'Processing' : loadingStep
        }
        return 'Pay'
    }, [isProcessing, loadingStep])

    // show error if charge details are missing
    if (!chargeDetails) {
        const message = paymentError
            ? paymentError
            : chargeIdFromUrl
              ? `Could not load details. Please go back and try again.`
              : 'Payment details are missing. Please go back and try again.'
        const handleGoBack = () => dispatch(paymentActions.setView('INITIAL'))
        return (
            <div className="space-y-4 text-center">
                <ErrorAlert description={message} />
                <Button onClick={handleGoBack}>Go Back</Button>
            </div>
        )
    }

    if (isPintaReq) {
        return (
            <div className="space-y-4">
                <FlowHeader
                    onPrev={() => {
                        dispatch(paymentActions.setView('INITIAL'))
                        window.history.replaceState(null, '', `${window.location.pathname}`)
                        dispatch(paymentActions.setChargeDetails(null))
                    }}
                />
                <PintaReqViewWrapper view="CONFIRM">
                    <div className="flex flex-col items-center justify-center gap-3 pt-2">
                        <div className="text-h8">You're paying for</div>
                        <div className="space-y-2 text-center">
                            <div className="text-h5 font-bold">
                                {beerQuantity} {beerQuantity > 1 ? 'Beers' : 'Beer'}
                            </div>
                            <p className="text-xs font-normal">From your Beer Account</p>
                        </div>
                    </div>
                    <PeanutSponsored />
                    <Divider />
                    <Button
                        variant="purple"
                        onClick={handlePayment}
                        disabled={!isConnected || isProcessing || isInsufficientRewardsBalance || beerQuantity <= 0}
                        loading={isProcessing}
                    >
                        {getButtonText()}
                    </Button>
                    {beerQuantity <= 0 && <ErrorAlert description="Please select at least 1 beer to continue." />}
                    {isInsufficientRewardsBalance && (
                        <ErrorAlert
                            description={`You do not have enough balance in your Beer Account to claim ${beerQuantity} beers.`}
                        />
                    )}
                    {paymentError && <ErrorAlert description={paymentError} />}
                </PintaReqViewWrapper>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <FlowHeader
                onPrev={() => {
                    dispatch(paymentActions.setView('INITIAL'))
                    window.history.replaceState(null, '', `${window.location.pathname}`)
                    dispatch(paymentActions.setChargeDetails(null))
                }}
            />
            <UserCard
                type="payment"
                username={parsedPaymentData?.recipient?.identifier || chargeDetails?.requestLink?.recipientAddress}
                recipientType={parsedPaymentData?.recipient?.recipientType}
            />
            <Card className="rounded-sm">
                <PaymentInfoRow
                    label="Amount"
                    value={
                        <span className="font-bold">
                            {formatAmount(Number(chargeDetails.tokenAmount))} {chargeDetails?.tokenSymbol}
                        </span>
                    }
                />

                <PaymentInfoRow
                    label="To"
                    value={
                        <AddressLink
                            className="text-sm font-bold text-black"
                            address={
                                parsedPaymentData?.recipient?.identifier || chargeDetails?.requestLink?.recipientAddress
                            }
                        />
                    }
                />

                <PaymentInfoRow
                    loading={isProcessing}
                    label="Network"
                    value={`${getReadableChainName(selectedChainID)}`}
                />

                {/* Fee Details Section */}
                <PaymentInfoRow
                    hideBottomBorder
                    loading={isCalculatingFees || isEstimatingGas}
                    label="Fee"
                    value={`$${feeCalculations.estimatedFee}`}
                />
            </Card>

            <div className="flex flex-col gap-2">
                {paymentError && (
                    <div className="space-y-2">
                        <ErrorAlert description={paymentError} />
                    </div>
                )}
                <Button
                    disabled={isProcessing}
                    onClick={handlePayment}
                    loading={isProcessing}
                    shadowSize="4"
                    className="w-full"
                >
                    {getButtonText()}
                </Button>
            </div>
        </div>
    )
}
