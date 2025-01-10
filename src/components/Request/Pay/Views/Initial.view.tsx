import { useCreateLink } from '@/components/Create/useCreateLink'
import AddressLink from '@/components/Global/AddressLink'
import FeeDescription from '@/components/Global/FeeDescription'
import InfoRow from '@/components/Global/InfoRow'
import Loading from '@/components/Global/Loading'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { ReferenceAndAttachment } from '@/components/Request/Components/ReferenceAndAttachment'
import * as consts from '@/constants'
import * as context from '@/context'
import { type ITokenPriceData } from '@/interfaces'
import {
    areTokenAddressesEqual,
    ErrorHandler,
    fetchTokenSymbol,
    getChainProvider,
    isAddressZero,
    saveRequestLinkFulfillmentToLocalStorage,
} from '@/utils'
import { formatAmount, switchNetwork as switchNetworkUtil } from '@/utils/general.utils'
import { checkTokenSupportsXChain } from '@/utils/token.utils'
import { useAppKit } from '@reown/appkit/react'
import { interfaces, peanut } from '@squirrel-labs/peanut-sdk'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import * as _consts from '../Pay.consts'

const ERR_NO_ROUTE = 'No route found to pay in this chain and token'

enum ViewState {
    INITIAL = 'INITIAL',
    LOADING = 'LOADING',
    READY_TO_PAY = 'READY_TO_PAY',
    ERROR = 'ERROR',
}

async function createXChainUnsignedTx({
    tokenData,
    requestLink,
    senderAddress,
}: {
    tokenData: ITokenPriceData
    requestLink: Awaited<ReturnType<typeof peanut.getRequestLinkDetails>>
    senderAddress: string
}) {
    const provider = getChainProvider(tokenData.chainId) || (await peanut.getDefaultProvider(tokenData.chainId))
    const xchainUnsignedTxs = await peanut.prepareXchainRequestFulfillmentTransaction({
        fromToken: tokenData.address,
        fromChainId: tokenData.chainId,
        senderAddress,
        squidRouterUrl: 'https://apiplus.squidrouter.com/v2/route',
        provider,
        tokenType: isAddressZero(tokenData.address)
            ? interfaces.EPeanutLinkType.native
            : interfaces.EPeanutLinkType.erc20,
        fromTokenDecimals: tokenData.decimals as number,
        linkDetails: requestLink,
    })
    return xchainUnsignedTxs
}

export const InitialView = ({
    onNext,
    requestLinkData,
    estimatedGasCost,
    setTransactionHash,
    tokenPriceData,
    unsignedTx,
    estimatedPoints,
}: _consts.IPayScreenProps) => {
    const { sendTransactions, checkUserHasEnoughBalance } = useCreateLink()
    const { isConnected, address, chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const { open } = useAppKit()
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const {
        selectedTokenData,
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
        isXChain,
        setIsXChain,
        isFetchingTokenData,
        supportedSquidChainsAndTokens,
    } = useContext(context.tokenSelectorContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [txFee, setTxFee] = useState<string>('0')
    const [isFeeEstimationError, setIsFeeEstimationError] = useState<boolean>(false)
    const [viewState, setViewState] = useState<ViewState>(ViewState.INITIAL)
    const [estimatedFromValue, setEstimatedFromValue] = useState<string>('0')
    const [tokenRequestedLogoURI, setTokenRequestedLogoURI] = useState<string | undefined>(undefined)
    const [tokenRequestedSymbol, setTokenRequestedSymbol] = useState<string>('')
    const [slippagePercentage, setSlippagePercentage] = useState<number | undefined>(undefined)
    const [xChainUnsignedTxs, setXChainUnsignedTxs] = useState<interfaces.IPeanutUnsignedTransaction[] | undefined>(
        undefined
    )

    const calculatedSlippage = useMemo(() => {
        if (!selectedTokenData?.price || !slippagePercentage) return null
        return ((slippagePercentage / 100) * selectedTokenData.price * Number(estimatedFromValue)).toFixed(2)
    }, [slippagePercentage, selectedTokenData, estimatedFromValue])

    const feeCalculations = useMemo(() => {
        // percentage of maximum network fee to use as expected fee (70%)
        const EXPECTED_NETWORK_FEE_MULTIPLIER = 0.7

        // percentage of maximum slippage to use as expected slippage (10%)
        const EXPECTED_SLIPPAGE_MULTIPLIER = 0.1

        // gas/network cost calculation (70% of max for expected)
        const networkFee = {
            expected: isXChain
                ? Number(txFee) * EXPECTED_NETWORK_FEE_MULTIPLIER
                : Number(estimatedGasCost) * EXPECTED_NETWORK_FEE_MULTIPLIER,
            max: isXChain ? Number(txFee) : Number(estimatedGasCost),
        }

        // slippage calculation (10% of max for expected)
        const slippage = calculatedSlippage
            ? {
                  expected: Number(calculatedSlippage) * EXPECTED_SLIPPAGE_MULTIPLIER,
                  max: Number(calculatedSlippage),
              }
            : undefined

        // calculate total max (requested amount + max network fee + max slippage)
        const requestedAmountUSD = tokenPriceData
            ? Number(requestLinkData.tokenAmount) * tokenPriceData.price
            : Number(requestLinkData.tokenAmount)

        const totalMax = requestedAmountUSD + networkFee.max + (slippage?.max || 0)

        // ensure values are at least 0.01 to avoid scientific notation
        const formatNumberSafely = (num: number) => {
            return formatAmount(num < 0.01 && num > 0 ? 0.01 : num)
        }

        return {
            networkFee: {
                expected: formatNumberSafely(networkFee.expected || 0),
            },
            slippage: slippage
                ? {
                      expected: formatNumberSafely(slippage.expected || 0),
                      max: formatNumberSafely(slippage.max || 0),
                  }
                : undefined,
            expectedTotal: formatNumberSafely(networkFee.expected + (slippage?.expected || 0) || 0),
            totalMax: formatNumberSafely(totalMax || 0),
        }
    }, [isXChain, txFee, estimatedGasCost, calculatedSlippage, tokenPriceData, requestLinkData.tokenAmount])

    const isButtonDisabled = useMemo(() => {
        return (
            viewState === ViewState.LOADING ||
            viewState === ViewState.ERROR ||
            (viewState === ViewState.READY_TO_PAY && !feeCalculations.expectedTotal)
        )
    }, [viewState, isLoading, feeCalculations.expectedTotal])

    const requestedAmount = useMemo(() => {
        const amount = tokenPriceData
            ? Number(requestLinkData.tokenAmount) * tokenPriceData.price
            : Number(requestLinkData.tokenAmount)

        if (tokenPriceData) {
            return `$ ${formatAmount(amount)}`
        } else {
            return `${formatAmount(amount)} ${tokenRequestedSymbol}`
        }
    }, [tokenPriceData, requestLinkData.tokenAmount, tokenRequestedSymbol])

    const tokenSupportsXChain = useMemo(() => {
        return checkTokenSupportsXChain(
            requestLinkData.tokenAddress,
            requestLinkData.chainId,
            supportedSquidChainsAndTokens
        )
    }, [requestLinkData.tokenAddress, requestLinkData.chainId, supportedSquidChainsAndTokens])

    // Get route
    useEffect(() => {
        const estimateTxFee = async () => {
            if (!isXChain) {
                clearError()
                setViewState(ViewState.READY_TO_PAY)
                return
            }
            try {
                clearError()
                setLoadingState('Preparing transaction')
                const txData = await createXChainUnsignedTx({
                    tokenData: selectedTokenData!,
                    requestLink: requestLinkData,
                    senderAddress: address!,
                })
                const {
                    feeEstimation,
                    estimatedFromAmount,
                    slippagePercentage,
                    unsignedTxs: _xChainUnsignedTxs,
                } = txData
                setEstimatedFromValue(estimatedFromAmount)
                setSlippagePercentage(slippagePercentage)
                setXChainUnsignedTxs(_xChainUnsignedTxs)
                clearError()
                setTxFee(Number(feeEstimation).toFixed(2))
                setViewState(ViewState.READY_TO_PAY)
            } catch (error) {
                setErrorState({ showError: true, errorMessage: ERR_NO_ROUTE })
                setIsFeeEstimationError(true)
                setSlippagePercentage(undefined)
                setXChainUnsignedTxs(undefined)
                setTxFee('0')
            }
        }

        if (!isConnected || !address) {
            setViewState(ViewState.INITIAL)
            return
        }

        if (isXChain && !selectedTokenData) {
            if (!isFetchingTokenData) {
                setErrorState({ showError: true, errorMessage: ERR_NO_ROUTE })
                setIsFeeEstimationError(true)
                setTxFee('0')
            }
            return
        }

        estimateTxFee()
    }, [isConnected, address, selectedTokenData, requestLinkData, isXChain, isFetchingTokenData])

    // Change in pair
    useEffect(() => {
        setLoadingState('Loading')
        clearError()
        setSlippagePercentage(undefined)
        setXChainUnsignedTxs(undefined)
        const isXChain =
            selectedChainID !== requestLinkData.chainId ||
            !areTokenAddressesEqual(selectedTokenAddress, requestLinkData.tokenAddress)
        setIsXChain(isXChain)
    }, [selectedChainID, selectedTokenAddress])

    // Fetch token symbol and logo
    useEffect(() => {
        let isMounted = true
        const chainDetails = consts.peanutTokenDetails.find((chain) => chain.chainId === requestLinkData.chainId)
        const logoURI =
            chainDetails?.tokens.find((token) => areTokenAddressesEqual(token.address, requestLinkData.tokenAddress))
                ?.logoURI ?? tokenPriceData?.logoURI
        setTokenRequestedLogoURI(logoURI)

        const tokenSymbol = requestLinkData.tokenSymbol ?? tokenPriceData?.symbol
        if (tokenSymbol) {
            setTokenRequestedSymbol(tokenSymbol)
        } else {
            fetchTokenSymbol(requestLinkData.tokenAddress, requestLinkData.chainId).then((tokenSymbol) => {
                if (isMounted) {
                    setTokenRequestedSymbol(tokenSymbol ?? '')
                }
            })
        }

        return () => {
            isMounted = false
        }
    }, [requestLinkData, tokenPriceData])

    // Transition into loading state
    useEffect(() => {
        if (isLoading) {
            setViewState(ViewState.LOADING)
        }
    }, [isLoading])

    // Transition into idle state
    useEffect(() => {
        if (viewState !== ViewState.LOADING) {
            setLoadingState('Idle')
        }
    }, [viewState])

    // Transition into error state
    useEffect(() => {
        if (errorState.showError) {
            setViewState(ViewState.ERROR)
        }
    }, [errorState])

    const clearError = () => {
        setErrorState({ showError: false, errorMessage: '' })
        setIsFeeEstimationError(false)
    }

    const handleConnectWallet = async () => {
        open().finally(() => {
            if (isConnected) setLoadingState('Loading')
        })
    }

    const switchNetwork = async (chainId: string) => {
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
        } catch (error) {
            console.error('Failed to switch network:', error)
        }
    }

    const handleOnNext = async () => {
        const amountUsd = (Number(requestLinkData.tokenAmount) * (tokenPriceData?.price ?? 0)).toFixed(2)
        try {
            clearError()
            if (!unsignedTx) return
            if (!isXChain) {
                await checkUserHasEnoughBalance({ tokenValue: requestLinkData.tokenAmount })
                if (requestLinkData.chainId !== String(currentChain?.id)) {
                    await switchNetwork(requestLinkData.chainId)
                }
                setLoadingState('Sign in wallet')
                const hash = await sendTransactions({
                    preparedDepositTxs: { unsignedTxs: [unsignedTx] },
                    feeOptions: undefined,
                })

                setLoadingState('Executing transaction')

                await peanut.submitRequestLinkFulfillment({
                    chainId: requestLinkData.chainId,
                    hash: hash ?? '',
                    payerAddress: address ?? '',
                    link: requestLinkData.link,
                    apiUrl: '/api/proxy/patch/',
                    amountUsd,
                })

                const currentDate = new Date().toISOString()
                saveRequestLinkFulfillmentToLocalStorage({
                    details: {
                        ...requestLinkData,
                        destinationChainFulfillmentHash: hash ?? '',
                        createdAt: currentDate,
                    },
                    link: requestLinkData.link,
                })

                setTransactionHash(hash ?? '')
                onNext()
            } else {
                if (!xChainUnsignedTxs) return
                await checkUserHasEnoughBalance({ tokenValue: estimatedFromValue })
                if (selectedTokenData!.chainId !== String(currentChain?.id)) {
                    await switchNetwork(selectedTokenData!.chainId)
                }
                setLoadingState('Sign in wallet')

                const hash = await sendTransactions({
                    preparedDepositTxs: { unsignedTxs: xChainUnsignedTxs },
                    feeOptions: undefined,
                })
                setLoadingState('Executing transaction')
                setTransactionHash(hash ?? '')
                onNext()
            }
        } catch (error) {
            const errorString = ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
            console.error('Error while submitting request link fulfillment:', error)
        }
    }

    const resetTokenAndChain = () => {
        setSelectedChainID(requestLinkData.chainId)
        setSelectedTokenAddress(requestLinkData.tokenAddress)
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <ReferenceAndAttachment
                reference={requestLinkData?.reference}
                attachmentUrl={requestLinkData?.attachmentUrl}
            />
            <div className="flex w-full flex-col items-center justify-center gap-2">
                <label className="text-h4">
                    <AddressLink address={requestLinkData.recipientAddress} /> is requesting
                </label>

                <label className="text-h2">{requestedAmount}</label>
                <div>
                    <div className="flex flex-row items-center justify-center gap-2 pl-1 text-h7">
                        <div className="relative h-6 w-6">
                            <img src={tokenRequestedLogoURI} className="absolute left-0 top-0 h-6 w-6" alt="logo" />
                            <img
                                src={
                                    consts.supportedPeanutChains.find(
                                        (chain) => chain.chainId === requestLinkData.chainId
                                    )?.icon.url
                                }
                                className="absolute -top-1 left-3 h-4 w-4 rounded-full" // Adjust `left-3` to control the overlap
                                alt="logo"
                            />
                        </div>
                        {formatAmount(requestLinkData.tokenAmount)} {tokenRequestedSymbol} on{' '}
                        {consts.supportedPeanutChains.find((chain) => chain.chainId === requestLinkData.chainId)?.name}
                    </div>
                </div>
                {tokenSupportsXChain ? (
                    <label className="text-h9 font-light">
                        You can fulfill this payment request with any token on any chain. Pick the token and chain that
                        you want to fulfill this request with.
                    </label>
                ) : (
                    <label className="text-h9 font-light">
                        This token does not support cross-chain transfers. You can only fulfill this payment request
                        with the selected token on the selected chain.
                    </label>
                )}
            </div>
            {tokenSupportsXChain && <TokenSelector onReset={resetTokenAndChain} showOnlySquidSupported />}
            <div className="flex w-full flex-col items-center justify-center gap-2">
                {!isFeeEstimationError && (
                    <>
                        <FeeDescription
                            loading={
                                Number(feeCalculations.expectedTotal) === 0 ||
                                Number(feeCalculations.networkFee.expected) === 0 ||
                                isLoading
                            }
                            estimatedFee={feeCalculations.expectedTotal}
                            networkFee={feeCalculations.networkFee.expected}
                            slippageRange={
                                feeCalculations.slippage
                                    ? {
                                          min: feeCalculations.slippage.expected,
                                          max: feeCalculations.slippage.max,
                                      }
                                    : undefined
                            }
                        />

                        <InfoRow
                            loading={Number(feeCalculations.totalMax) === 0 || isLoading}
                            iconName="transfer"
                            label="Total Max"
                            value={`$ ${feeCalculations.totalMax}`}
                            moreInfoText={
                                feeCalculations.slippage
                                    ? 'Maximum amount you will pay including requested amount, fees, and maximum slippage.'
                                    : 'Maximum amount you will pay including requested amount and network fees.'
                            }
                        />
                    </>
                )}
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <button
                    className="wc-disable-mf btn-purple btn-xl "
                    disabled={isButtonDisabled}
                    onClick={() => {
                        if (!isConnected) handleConnectWallet()
                        else if (ViewState.READY_TO_PAY === viewState) handleOnNext()
                    }}
                >
                    {viewState === ViewState.LOADING ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : !isConnected ? (
                        'Connect Wallet'
                    ) : (
                        'Pay'
                    )}
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
