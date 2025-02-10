import { Button } from '@/components/0_Bruddle'
import { useCreateLink } from '@/components/Create/useCreateLink'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import { IRequestLinkData, IRequestLinkState } from '@/components/Request/Pay/Pay.consts'
import { supportedPeanutChains } from '@/constants'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ITokenPriceData } from '@/interfaces'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import {
    fetchTokenPrice,
    resolveFromEnsName,
    saveRequestLinkFulfillmentToLocalStorage,
    switchNetwork as switchNetworkUtil,
} from '@/utils'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useContext, useEffect, useState } from 'react'
import { useSwitchChain } from 'wagmi'
interface PaymentDetails {
    recipient: string
    amount?: string
    token?: string
    chain?: string | number
}

export default function ConfirmPaymentView() {
    const dispatch = useAppDispatch()
    const [showMessage, setShowMessage] = useState<boolean>(false)
    const { chain: currentChain } = useWallet()
    const { attachmentOptions, urlParams, requestDetails } = usePaymentStore()
    const { selectedChainID, selectedTokenData } = useContext(tokenSelectorContext)
    const { setLoadingState, isLoading } = useContext(loadingStateContext)
    const { address, isConnected } = useWallet()
    const { switchChainAsync } = useSwitchChain()
    // const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string>('')
    const { sendTransactions, checkUserHasEnoughBalance, estimateGasFee } = useCreateLink()

    // states
    const [linkState, setLinkState] = useState<IRequestLinkState>(IRequestLinkState.LOADING)
    const [tokenPriceData, setTokenPriceData] = useState<ITokenPriceData | undefined>(undefined)
    const [requestLinkData, setRequestLinkData] = useState<IRequestLinkData | undefined>(undefined)
    const [estimatedGasCost, setEstimatedGasCost] = useState<number | undefined>(undefined)
    const [transactionHash, setTransactionHash] = useState<string>('')
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | undefined>(undefined)
    const [errorMessage, setErrorMessage] = useState<string>('')

    // Get selected chain details
    const selectedChain = supportedPeanutChains.find((chain) => chain.chainId.toString() === selectedChainID)

    const fetchRecipientAddress = async (address: string): Promise<string> => {
        if (!address.endsWith('eth')) {
            return address
        }
        const resolvedAddress = await resolveFromEnsName(address.toLowerCase())
        if (!resolvedAddress) {
            throw new Error('Failed to resolve ENS name')
        }
        // todo: resolve peanut username to wallet address
        return resolvedAddress
    }

    const switchNetwork = async (chainId: string): Promise<boolean> => {
        try {
            await switchNetworkUtil({
                chainId,
                currentChainId: String(currentChain?.id),
                setLoadingState,
                switchChainAsync: async ({ chainId }) => {
                    await switchChainAsync({ chainId: chainId as number })
                },
            })
            console.log(`Switched to chain ${chainId}`)
            return true
        } catch (error) {
            console.error('Failed to switch network:', error)
            throw new Error(`Failed to switch to network ${chainId}`)
        }
    }

    const handlePayment = async () => {
        if (!isConnected || !address || !requestDetails) return
        const amountUsd = (Number(requestDetails.tokenAmount) * (tokenPriceData?.price ?? 0)).toFixed(2)

        try {
            setError('')

            console.log('requestDetails', requestDetails)

            if (!unsignedTx) {
                throw new Error('Transaction data not ready')
            }

            await checkUserHasEnoughBalance({ tokenValue: requestDetails.tokenAmount })
            if (requestDetails.chainId !== String(currentChain?.id)) {
                await switchNetwork(requestDetails.chainId)
            }
            setLoadingState('Sign in wallet')
            const hash = await sendTransactions({
                preparedDepositTxs: { unsignedTxs: [unsignedTx] },
                feeOptions: undefined,
            })

            setLoadingState('Executing transaction')

            await peanut.submitRequestLinkFulfillment({
                chainId: requestDetails.chainId,
                hash: hash ?? '',
                payerAddress: address,
                link: requestDetails.link,
                apiUrl: '/api/proxy/patch/',
                amountUsd,
            })

            const currentDate = new Date().toISOString()
            saveRequestLinkFulfillmentToLocalStorage({
                details: {
                    ...requestDetails,
                    destinationChainFulfillmentHash: hash ?? '',
                    createdAt: currentDate,
                },
                link: requestDetails.link,
            })

            setTransactionHash(hash ?? '')

            dispatch(paymentActions.setView(3))
        } catch (error) {
            setError((error as Error).message)
        } finally {
            // todo: add loading state
        }
    }

    useEffect(() => {
        if (!requestDetails) return

        // Fetch token price
        fetchTokenPrice(requestDetails.tokenAddress.toLowerCase(), requestDetails.chainId).then((tokenPriceData) => {
            if (tokenPriceData) {
                setTokenPriceData(tokenPriceData)
            } else {
                setErrorMessage('Failed to fetch token price, please try again later')
                setLinkState(IRequestLinkState.ERROR)
            }
        })

        fetchRecipientAddress(requestDetails.recipientAddress)
            .then((recipientAddress) => {
                const tokenType = Number(requestDetails.tokenType)
                const { unsignedTx } = peanut.prepareRequestLinkFulfillmentTransaction({
                    recipientAddress: recipientAddress,
                    tokenAddress: requestDetails.tokenAddress,
                    tokenAmount: requestDetails.tokenAmount,
                    tokenDecimals: requestDetails.tokenDecimals,
                    tokenType: tokenType,
                })
                console.log('unsignedTx', unsignedTx)
                setUnsignedTx(unsignedTx)
            })
            .catch((error) => {
                console.log('error fetching recipient address:', error)
                setErrorMessage('Failed to fetch recipient address, please try again later')
                setLinkState(IRequestLinkState.ERROR)
            })

        // Prepare request link fulfillment transaction
    }, [requestDetails])

    useEffect(() => {
        if (!requestDetails || !unsignedTx) return

        // Estimate gas fee
        estimateGasFee({ chainId: requestDetails.chainId, preparedTx: unsignedTx })
            .then(({ transactionCostUSD }) => {
                if (transactionCostUSD) setEstimatedGasCost(transactionCostUSD)
            })
            .catch((error) => {
                console.log('error calculating transaction cost:', error)
                setErrorMessage('Failed to estimate gas fee, please try again later')
                setLinkState(IRequestLinkState.ERROR)
            })
    }, [unsignedTx, requestDetails])

    return (
        <div className="space-y-4">
            <FlowHeader onPrev={() => dispatch(paymentActions.setView(1))} disableWalletHeader />

            <div className="pb-1 text-start text-h4 font-bold">Confirm Details</div>
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <div className="text-sm font-semibold text-grey-1">Recipient</div>
                    </div>
                    <div className="font-semibold">{urlParams?.recipient}</div>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <div className="text-sm font-semibold text-grey-1">Amount</div>
                    </div>
                    {urlParams?.amount && <div className="font-semibold">{urlParams?.amount}</div>}
                </div>

                {/* URL Parameters Section */}
                {urlParams?.chain && (
                    <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                        <div className="text-sm font-semibold text-grey-1">URL Chain</div>
                        <div className="font-semibold capitalize">{urlParams.chain}</div>
                    </div>
                )}

                {urlParams?.token && (
                    <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                        <div className="text-sm font-semibold text-grey-1">URL Token</div>

                        <div className="font-semibold uppercase">{urlParams.token}</div>
                    </div>
                )}

                {/* Selected Values Section */}
                {selectedChain && (
                    <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                        <div className="text-sm font-semibold text-grey-1">Selected Chain</div>
                        <div className="flex items-center gap-1">
                            <div className="font-semibold">{selectedChain.name}</div>
                        </div>
                    </div>
                )}

                {selectedTokenData && (
                    <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                        <div className="text-sm font-semibold text-grey-1">Selected Token</div>
                        <div className="flex items-center gap-1">
                            {/* {selectedToken.logoURI && (
                                <Image
                                    src={selectedToken.logoURI}
                                    alt={selectedToken.symbol}
                                    width={20}
                                    height={20}
                                    unoptimized
                                />
                            )} */}
                            <div className="font-semibold">{selectedTokenData.symbol}</div>
                        </div>
                    </div>
                )}

                {attachmentOptions.fileUrl && (
                    <div className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black pb-2">
                        <div className="flex w-full cursor-pointer flex-row items-center justify-between gap-1 text-h8 text-grey-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'paperclip'} className="h-4 fill-grey-1" />
                                <div className="text-sm font-semibold text-grey-1">Attachment</div>
                            </div>
                            <a
                                href={attachmentOptions.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-start text-sm font-semibold leading-4 hover:underline"
                            >
                                <span>Download </span>
                                <Icon name={'download'} className="h-4 fill-grey-1" />
                            </a>
                        </div>
                    </div>
                )}

                {attachmentOptions?.message && (
                    <div
                        onClick={() => setShowMessage(!showMessage)}
                        className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black pb-2"
                    >
                        <div className="flex w-full cursor-pointer flex-row items-center justify-between gap-1 text-h8 text-grey-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'email'} className="h-4 fill-grey-1" />
                                <div className="text-sm font-semibold text-grey-1">Message</div>
                            </div>
                            <Icon
                                name={'arrow-bottom'}
                                className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showMessage && 'rotate-180'}`}
                            />
                        </div>

                        {showMessage && (
                            <div className="flex w-full flex-col items-center justify-center gap-1 py-1 text-h8 text-grey-1">
                                <div className="w-full text-start text-sm font-normal leading-4">
                                    {attachmentOptions.message}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="text-xs">
                Please confirm all the details before sending the payment, you can edit the details by clicking on the
                back button on the top left corner.
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row-reverse">
                <Button onClick={handlePayment} disabled={!isConnected || isLoading} className="w-full">
                    {!isConnected ? 'Connect Wallet' : isLoading ? 'Processing...' : 'Pay'}
                </Button>
            </div>

            {error && <div className="text-red-500">{error}</div>}

            {/* todo: add error state */}
        </div>
    )
}
