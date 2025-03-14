import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import { useCreateLink } from '@/components/Create/useCreateLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FlowHeader from '@/components/Global/FlowHeader'
import PeanutSponsored from '@/components/Global/PeanutSponsored'
import { loadingStateContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { switchNetwork } from '@/utils'
import { ErrorHandler } from '@/utils/sdkErrorHandler.utils'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useContext, useEffect, useState } from 'react'
import { useSwitchChain } from 'wagmi'
import PintaReqViewWrapper from '../PintaReqViewWrapper'

const POLYGON_CHAIN_ID = '137'

const PintaReqPayConfirmView = () => {
    const dispatch = useAppDispatch()
    const { beerQuantity, requestDetails, chargeDetails, error } = usePaymentStore()
    const { isConnected, selectedWallet, chain: currentChain } = useWallet()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { sendTransactions, checkUserHasEnoughBalance, estimateGasFee } = useCreateLink()
    const { setLoadingState } = useContext(loadingStateContext)
    const { switchChainAsync } = useSwitchChain()
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | undefined>()
    const [isFeeEstimationError, setIsFeeEstimationError] = useState<boolean>(false)
    const [feeOptions, setFeeOptions] = useState<any | undefined>(undefined)
    const [isPreparingTx, setIsPreparingTx] = useState(true)
    const [loadingMessage, setLoadingMessage] = useState('Preparing transaction...')
    const [isWaitingForSignature, setIsWaitingForSignature] = useState(false)

    // prepare transaction
    useEffect(() => {
        if (!requestDetails) return
        setIsPreparingTx(true)
        setLoadingMessage('Preparing transaction...')

        const prepareTx = async () => {
            try {
                // Prepare transaction
                const tx = await peanut.prepareRequestLinkFulfillmentTransaction({
                    recipientAddress: requestDetails.recipientAddress,
                    tokenAddress: requestDetails.tokenAddress,
                    tokenAmount: '0.00002', // TODO: Remove hardcoded test amount after testing
                    tokenDecimals: requestDetails.tokenDecimals,
                    tokenType: Number(requestDetails.tokenType) as peanutInterfaces.EPeanutLinkType,
                })

                if (!tx?.unsignedTx) {
                    throw new Error('Failed to prepare transaction')
                }

                setUnsignedTx(tx.unsignedTx)
                setLoadingMessage('Hang onn...')

                const { feeOptions: calculatedFeeOptions } = await estimateGasFee({
                    chainId: requestDetails.chainId,
                    preparedTx: tx.unsignedTx,
                })

                if (calculatedFeeOptions) setFeeOptions(calculatedFeeOptions)
                setIsPreparingTx(false)
            } catch (error) {
                console.error('Error preparing transaction:', error)
                setIsFeeEstimationError(true)
                dispatch(paymentActions.setError('Failed to prepare transaction'))
                setIsPreparingTx(false)
            }
        }

        prepareTx()
    }, [requestDetails, beerQuantity])

    const handleSendTransaction = async () => {
        if (!isConnected || !selectedWallet || !unsignedTx || !chargeDetails) return

        setIsSubmitting(true)
        dispatch(paymentActions.setError(null))

        try {
            // check balance and switch network
            setLoadingMessage('Checking balance...')
            await checkUserHasEnoughBalance({
                tokenValue: chargeDetails.tokenAmount,
            })

            if (currentChain && POLYGON_CHAIN_ID !== String(currentChain?.id)) {
                setLoadingMessage('Switching network...')
                await switchNetwork({
                    chainId: POLYGON_CHAIN_ID,
                    currentChainId: String(currentChain?.id),
                    setLoadingState,
                    switchChainAsync: async ({ chainId: _chainId }) => {
                        await switchChainAsync({ chainId: Number(POLYGON_CHAIN_ID) })
                    },
                })
            }

            // send transaction
            setLoadingMessage('Waiting for confirmation...')
            setIsWaitingForSignature(true)
            const hash = await sendTransactions({
                preparedDepositTxs: {
                    unsignedTxs: [unsignedTx],
                },
                feeOptions,
            })
            setIsWaitingForSignature(false)

            if (!hash) {
                throw new Error('Failed to send transaction')
            }

            // create payment
            setLoadingMessage('Processing payment...')
            const paymentDetails = await chargesApi.createPayment({
                chargeId: chargeDetails.uuid,
                chainId: requestDetails!.chainId,
                hash,
                tokenAddress: requestDetails!.tokenAddress,
            })

            dispatch(paymentActions.setTransactionHash(hash))
            dispatch(paymentActions.setPaymentDetails(paymentDetails))
            dispatch(paymentActions.setView('STATUS'))
        } catch (error) {
            console.error('Failed to process payment:', error)
            const errorString = ErrorHandler(error)
            dispatch(paymentActions.setError(errorString))
        } finally {
            setIsSubmitting(false)
            setIsWaitingForSignature(false)
        }
    }

    return (
        <div>
            <div className="space-y-4">
                <FlowHeader
                    onPrev={() => {
                        dispatch(paymentActions.setView('INITIAL'))
                        window.history.replaceState(null, '', `${window.location.pathname}`)
                        dispatch(paymentActions.setChargeDetails(null))
                        dispatch(paymentActions.setBeerQuantity(0))
                        dispatch(paymentActions.setError(null))
                    }}
                    disableWalletHeader
                />

                <PintaReqViewWrapper view="CONFIRM">
                    <div className="flex flex-col items-center justify-center gap-3 pt-2">
                        <div className="text-h8">You're Claiming</div>
                        <div className="space-y-2 text-center">
                            <div className="text-h5 font-bold">
                                {beerQuantity} {beerQuantity > 1 ? 'Beers' : 'Beer'}
                            </div>
                            <p className="text-xs font-normal">From Beer Account</p>
                        </div>
                    </div>
                    <PeanutSponsored />
                    <Divider />
                    <Button
                        variant="purple"
                        onClick={handleSendTransaction}
                        disabled={isSubmitting || isPreparingTx || isFeeEstimationError || isWaitingForSignature}
                        loading={isSubmitting || isPreparingTx}
                    >
                        {isPreparingTx || (isSubmitting && !isWaitingForSignature)
                            ? loadingMessage
                            : isWaitingForSignature
                              ? 'Please confirm in your wallet'
                              : 'Confirm'}
                    </Button>
                    {error && <ErrorAlert description={error} />}
                </PintaReqViewWrapper>
            </div>
        </div>
    )
}

export default PintaReqPayConfirmView
