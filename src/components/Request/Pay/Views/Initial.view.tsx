import { Button, Card } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useCreateLink } from '@/components/Create/useCreateLink'
import AddressLink from '@/components/Global/AddressLink'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { ReferenceAndAttachment } from '@/components/Request/Components/ReferenceAndAttachment'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_NAME,
    peanutTokenDetails,
    supportedPeanutChains,
} from '@/constants'
import * as context from '@/context'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'
import { type ITokenPriceData } from '@/interfaces'
import {
    areEvmAddressesEqual,
    ErrorHandler,
    fetchTokenSymbol,
    formatAmountWithSignificantDigits,
    formatTokenAmount,
    isAddressZero,
} from '@/utils'
import {
    formatAmount,
    saveRequestLinkFulfillmentToLocalStorage,
    switchNetwork as switchNetworkUtil,
} from '@/utils/general.utils'
import { checkTokenSupportsXChain } from '@/utils/token.utils'
import { interfaces, peanut } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
    const xchainUnsignedTxs = await peanut.prepareXchainRequestFulfillmentTransaction({
        fromToken: tokenData.address,
        fromChainId: tokenData.chainId,
        senderAddress,
        squidRouterUrl: 'https://apiplus.squidrouter.com/v2/route',
        provider: await peanut.getDefaultProvider(tokenData.chainId),
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
    const { address, signInModal, selectedWallet, chain: currentChain, isPeanutWallet, refetchBalances } = useWallet()
    const { isConnected: isExternalWalletConnected } = useAccount()
    const { handleLogin } = useZeroDev()
    const toast = useToast()

    const isConnected = isExternalWalletConnected || isPeanutWallet

    const { switchChainAsync } = useSwitchChain()
    const { setLoadingState, isLoading } = useContext(context.loadingStateContext)
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

    const calculatedFee = useMemo(() => {
        return isXChain ? txFee : formatTokenAmount(estimatedGasCost, 3)
    }, [isXChain, estimatedGasCost, txFee])

    const calculatedSlippage = useMemo(() => {
        if (!selectedTokenData?.price || !slippagePercentage) return null
        return ((slippagePercentage / 100) * selectedTokenData.price * Number(estimatedFromValue)).toFixed(2)
    }, [slippagePercentage, selectedTokenData, estimatedFromValue])

    const isButtonDisabled = useMemo(() => {
        return (
            viewState === ViewState.LOADING ||
            viewState === ViewState.ERROR ||
            (viewState === ViewState.READY_TO_PAY && !calculatedFee) ||
            (isPeanutWallet && isXChain) // disabled for peanut wallet xchain txs
        )
    }, [viewState, isLoading, calculatedFee, isPeanutWallet, isXChain])

    const requestedAmount = useMemo(() => {
        const amount = tokenPriceData
            ? Number(requestLinkData.tokenAmount) * tokenPriceData.price
            : Number(requestLinkData.tokenAmount)

        if (tokenPriceData) {
            return `$${formatAmount(amount)}`
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
            // skip route fetching for peanut wallet cross-chain txs
            if (!isXChain || (isPeanutWallet && isXChain)) {
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
            !areEvmAddressesEqual(selectedTokenAddress, requestLinkData.tokenAddress)
        setIsXChain(isXChain)
    }, [selectedChainID, selectedTokenAddress])

    // Fetch token symbol and logo
    useEffect(() => {
        let isMounted = true
        const chainDetails = peanutTokenDetails.find((chain) => chain.chainId === requestLinkData.chainId)
        const logoURI =
            chainDetails?.tokens.find((token) => areEvmAddressesEqual(token.address, requestLinkData.tokenAddress))
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

    const handleOnNext = async () => {
        const amountUsd = (Number(requestLinkData.tokenAmount) * (tokenPriceData?.price ?? 0)).toFixed(2)
        try {
            clearError()
            if (!address) {
                throw new Error('No wallet address available')
            }

            if (!isXChain) {
                if (!unsignedTx) {
                    throw new Error('Transaction data not ready')
                }

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

                // update wallet balance after successful req payment
                refetchBalances(address)
            } else {
                if (!xChainUnsignedTxs) {
                    throw new Error('Cross-chain transaction data not ready')
                }

                if (!selectedTokenData) {
                    throw new Error('Selected token data not available')
                }

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
            throw error
        }
    }

    const resetTokenAndChain = useCallback(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        } else {
            setSelectedChainID(requestLinkData.chainId)
            setSelectedTokenAddress(requestLinkData.tokenAddress)
        }
    }, [requestLinkData, isPeanutWallet])

    const handleSubmit = async () => {
        if (!isConnected) {
            if (isPeanutWallet) {
                handleLogin()
                    .catch((_error) => {
                        toast.error('Error logging in')
                    })
                    .finally(() => {
                        setLoadingState('Idle')
                    })
            } else {
                signInModal.open()
            }
            return
        }

        if (!address) {
            return
        }

        try {
            setLoadingState('Preparing transaction')

            if (ViewState.READY_TO_PAY === viewState) {
                if (!unsignedTx && !isXChain) {
                    throw new Error('Transaction data not ready')
                }

                if (isXChain && !xChainUnsignedTxs) {
                    throw new Error('Cross-chain transaction data not ready')
                }

                await handleOnNext()
                setLoadingState('Loading')
            }
        } catch (error) {
            console.error('Transaction error:', error)
            setLoadingState('Idle')
        }
    }

    const getButtonTitle = () => {
        if (!isConnected) {
            return 'Connect Wallet'
        }
        return 'Pay'
    }

    useEffect(() => {
        if (isPeanutWallet) resetTokenAndChain()
    }, [resetTokenAndChain, isPeanutWallet])

    return (
        <div>
            <FlowHeader />
            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title className="text-center text-h3">
                        <AddressLink address={requestLinkData.recipientAddress} /> is requesting
                    </Card.Title>
                </Card.Header>
                <Card.Content className="col gap-4">
                    <ReferenceAndAttachment
                        reference={requestLinkData?.reference}
                        attachmentUrl={requestLinkData?.attachmentUrl}
                    />
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <label className="text-h2">{requestedAmount}</label>
                        <div>
                            <div className="flex flex-row items-center justify-center gap-2 pl-1 text-h7">
                                <div className="relative h-6 w-6">
                                    <img
                                        src={tokenRequestedLogoURI}
                                        className="absolute left-0 top-0 h-6 w-6"
                                        alt="logo"
                                    />
                                    <img
                                        src={
                                            supportedPeanutChains.find(
                                                (chain) => chain.chainId === requestLinkData.chainId
                                            )?.icon.url
                                        }
                                        className="absolute -top-1 left-3 h-4 w-4 rounded-full" // Adjust `left-3` to control the overlap
                                        alt="logo"
                                    />
                                </div>
                                {formatAmountWithSignificantDigits(Number(requestLinkData.tokenAmount), 3)}{' '}
                                {tokenRequestedSymbol} on{' '}
                                {supportedPeanutChains.find((chain) => chain.chainId === requestLinkData.chainId)?.name}
                            </div>
                        </div>
                        {tokenSupportsXChain ? (
                            isPeanutWallet ? (
                                <label className="py-1 text-center text-h9 font-light">
                                    You can only fulfill payment requests with {PEANUT_WALLET_TOKEN_NAME} on{' '}
                                    {PEANUT_WALLET_CHAIN.name}. If you wish to use a different token or chain, please
                                    switch to an external wallet.
                                </label>
                            ) : (
                                <label className="py-1 text-center text-h9 font-light">
                                    You can fulfill this payment request with any token on any chain. Pick the token and
                                    chain that you want to fulfill this request with.
                                </label>
                            )
                        ) : (
                            <label className="py-1 text-center text-h9 font-light">
                                This token does not support cross-chain transfers. You can only fulfill this payment
                                request with the selected token on the selected chain.
                            </label>
                        )}
                    </div>
                    {isExternalWalletConnected && !isPeanutWallet && tokenSupportsXChain && (
                        <TokenSelector onReset={resetTokenAndChain} showOnlySquidSupported />
                    )}
                    {/* dont show network/slippage details if its a xchain peanut wallet tx */}
                    {!isFeeEstimationError && !(isPeanutWallet && isXChain) && (
                        <>
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1">
                                <div className="flex w-max flex-row items-center justify-center gap-1">
                                    <Icon name={'gas'} className="h-4 fill-grey-1" />
                                    <label className="font-bold">Network cost</label>
                                </div>
                                <label className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    {calculatedFee ? (
                                        `$${calculatedFee}`
                                    ) : (
                                        <div className="h-2 w-16 animate-colorPulse rounded bg-slate-700"></div>
                                    )}
                                    {!isXChain ? (
                                        <MoreInfo
                                            text={
                                                estimatedGasCost && estimatedGasCost > 0
                                                    ? `This transaction will cost you $${formatTokenAmount(estimatedGasCost, 3)} in network fees.`
                                                    : 'This transaction is sponsored by peanut! Enjoy!'
                                            }
                                        />
                                    ) : (
                                        <MoreInfo
                                            text={`This transaction will cost you $${formatTokenAmount(Number(txFee), 3)} in network fees.`}
                                        />
                                    )}
                                </label>
                            </div>

                            {null !== calculatedSlippage && (
                                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1">
                                    <div className="flex w-max flex-row items-center justify-center gap-1">
                                        <Icon name={'money-out'} className="h-4 fill-grey-1" />
                                        <label className="font-bold">Max slippage</label>
                                    </div>
                                    <label className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        ${calculatedSlippage}
                                        <MoreInfo
                                            text={`${slippagePercentage!.toFixed(2)}% is the maximum slippage set to ensure that the transaction goes through. It is likely to be much lower than the actual slippage`}
                                        />
                                    </label>
                                </div>
                            )}

                            {/* TODO: correct points estimation
                        <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-grey-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'plus-circle'} className="h-4 fill-grey-1" />
                                <label className="font-bold">Points</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                {estimatedPoints ? (
                                    `${estimatedPoints > 0 ? '+' : ''}${estimatedPoints}`
                                ) : (
                                    <div className="h-2 w-16 animate-colorPulse rounded bg-slate-700"></div>
                                )}
                                <MoreInfo
                                    text={
                                        estimatedPoints !== undefined
                                            ? estimatedPoints > 0
                                                ? `This transaction will add ${estimatedPoints} to your total points balance.`
                                                : 'This transaction will not add any points to your total points balance'
                                            : 'This transaction will not add any points to your total points balance'
                                    }
                                />
                            </span>
                        </div>
                            */}
                        </>
                    )}
                    <div className="flex w-full flex-col items-center justify-center gap-3">
                        <Button
                            disabled={isButtonDisabled}
                            onClick={handleSubmit}
                            loading={viewState === ViewState.LOADING}
                        >
                            {getButtonTitle()}
                        </Button>
                        {errorState.showError && (
                            <div className="self-start text-start">
                                <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                            </div>
                        )}

                        {isPeanutWallet && isXChain && (
                            <div className="self-start text-start">
                                <label className=" text-h8 font-normal text-red">
                                    Cross-chain payments are not supported with Peanut Wallet yet. Switch to an external
                                    wallet to pay this request.
                                </label>
                            </div>
                        )}
                    </div>
                </Card.Content>
            </Card>
        </div>
    )
}
