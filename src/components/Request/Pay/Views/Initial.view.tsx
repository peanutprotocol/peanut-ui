import * as _consts from '../Pay.consts'
import { useAccount, useSwitchChain } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useContext, useState } from 'react'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import * as utils from '@/utils'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import * as consts from '@/constants'
import { useCreateLink } from '@/components/Create/useCreateLink'
import { peanut } from '@squirrel-labs/peanut-sdk'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { switchNetwork as switchNetworkUtil } from '@/utils/general.utils'
import { ADDRESS_ZERO, EPeanutLinkType } from '../utils'

export const InitialView = ({
    onNext,
    requestLinkData,
    estimatedGasCost,
    setTransactionHash,
    tokenPrice,
    unsignedTx,
}: _consts.IPayScreenProps) => {
    const { sendTransactions, assertValues } = useCreateLink()
    const { isConnected, address, chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const { open } = useWeb3Modal()
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { selectedChainID, selectedTokenAddress, selectedTokenDecimals } = useContext(context.tokenSelectorContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const handleConnectWallet = async () => {
        open()
    }

    const switchNetwork = async (chainId: string) => {
        try {
            await switchNetworkUtil({
                chainId,
                currentChainId: currentChain?.id,
                setLoadingState,
                switchChainAsync,
            })
            console.log(`Switched to chain ${chainId}`)
        } catch (error) {
            console.error('Failed to switch network:', error)
        }
    }

    const handleOnNext = async () => {
        if (selectedChainID !== currentChain) {
            await switchNetwork(selectedChainID)
        }
        try {
            setErrorState({ showError: false, errorMessage: '' })
            if (!unsignedTx) return
            if (selectedChainID === requestLinkData.chainId && selectedTokenAddress === requestLinkData.tokenAddress) {
                await assertValues({ tokenValue: requestLinkData.tokenAmount })
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
                })

                const currentDate = new Date().toISOString()
                utils.saveRequestLinkFulfillmentToLocalStorage({
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
                setLoadingState('Sign in wallet')

                const xchainUnsignedTxs = await peanut.prepareXchainRequestFulfillmentTransaction({
                    fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    fromChainId: selectedChainID,
                    senderAddress: address ?? '',
                    recipientAddress: requestLinkData.recipientAddress as string,
                    destinationChainId: requestLinkData.chainId,
                    destinationToken: requestLinkData.tokenAddress,
                    link: requestLinkData.link,
                    squidRouterUrl: 'https://apiplus.squidrouter.com/v2/route',
                    apiUrl: '/api/proxy/get',
                    provider: await peanut.getDefaultProvider(selectedChainID),
                    tokenType: selectedTokenAddress === ADDRESS_ZERO ? EPeanutLinkType.native : EPeanutLinkType.erc20,
                    fromTokenDecimals: selectedTokenDecimals as number,
                })

                const { unsignedTxs } = xchainUnsignedTxs
                const hash = await sendTransactions({
                    preparedDepositTxs: { unsignedTxs },
                    feeOptions: undefined,
                })
                setLoadingState('Executing transaction')

                await peanut.submitRequestLinkFulfillment({
                    chainId: requestLinkData.chainId,
                    hash: hash ?? '',
                    payerAddress: address ?? '',
                    link: requestLinkData.link,
                    apiUrl: '/api/proxy/patch/',
                })

                const currentDate = new Date().toISOString()
                utils.saveRequestLinkFulfillmentToLocalStorage({
                    details: {
                        ...requestLinkData,
                        destinationChainFulfillmentHash: hash ?? '',
                        createdAt: currentDate,
                    },
                    link: requestLinkData.link,
                })

                setTransactionHash(hash ?? '')
                onNext()
            }
        } catch (error) {
            const errorString = utils.ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
            console.error('Error while submitting request link fulfillment:', error)
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            {(requestLinkData.reference || requestLinkData.attachmentUrl) && (
                <>
                    <div className={`flex w-full flex-col items-center justify-center  gap-2`}>
                        {requestLinkData.reference && (
                            <label className="max-w-full text-h8">
                                Ref: <span className="font-normal"> {requestLinkData.reference} </span>
                            </label>
                        )}
                        {requestLinkData.attachmentUrl && (
                            <a
                                href={requestLinkData.attachmentUrl}
                                download
                                target="_blank"
                                className="flex w-full cursor-pointer flex-row items-center justify-center gap-1 text-h9 font-normal text-gray-1 underline "
                            >
                                <Icon name={'download'} />
                                Download attachment
                            </a>
                        )}
                    </div>
                    <div className="flex w-full border-t border-dotted border-black" />
                </>
            )}

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <label className="text-h4">
                    {requestLinkData.recipientAddress.endsWith('.eth')
                        ? requestLinkData.recipientAddress
                        : utils.shortenAddress(requestLinkData.recipientAddress)}{' '}
                    is requesting
                </label>

                {tokenPrice ? (
                    <label className="text-h2">
                        $ {utils.formatTokenAmount(Number(requestLinkData.tokenAmount) * tokenPrice)}
                    </label>
                ) : (
                    <label className="text-h2 ">
                        {requestLinkData.tokenAmount} {requestLinkData.tokenSymbol}
                    </label>
                )}
                <div>
                    <div className="flex flex-row items-center justify-center gap-2 pl-1 text-h7">
                        <div className="relative h-6 w-6">
                            <img
                                src={
                                    consts.peanutTokenDetails
                                        .find((chain) => chain.chainId === requestLinkData.chainId)
                                        ?.tokens.find((token) => token.address === requestLinkData.tokenAddress)
                                        ?.logoURI
                                }
                                className="absolute left-0 top-0 h-6 w-6"
                                alt="logo"
                            />
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
                        {requestLinkData.tokenAmount}{' '}
                        {requestLinkData.tokenSymbol ??
                            consts.peanutTokenDetails
                                .find((chain) => chain.chainId === requestLinkData.chainId)
                                ?.tokens.find((token) =>
                                    utils.compareTokenAddresses(token.address, requestLinkData.tokenAddress)
                                )
                                ?.symbol.toUpperCase()}{' '}
                        on{' '}
                        {consts.supportedPeanutChains.find((chain) => chain.chainId === requestLinkData.chainId)?.name}
                    </div>
                </div>
                <label className="text-h9 font-light">
                    You can fulfill this payment request with any token on any chain. Pick the token and chain that you
                    want to fulfill this request with.
                </label>
            </div>
            <TokenSelector classNameButton="w-full" />
            <div className="flex w-full flex-col items-center justify-center gap-2">
                {estimatedGasCost && (
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            <Icon name={'gas'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Network cost</label>
                        </div>
                        <label className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            {estimatedGasCost === 0
                                ? '$0'
                                : estimatedGasCost < 0.01
                                  ? '$<0.01'
                                  : `$${utils.formatTokenAmount(estimatedGasCost, 3) ?? 0}`}
                            <MoreInfo
                                text={
                                    estimatedGasCost > 0
                                        ? `This transaction will cost you $${utils.formatTokenAmount(estimatedGasCost, 3)} in network fees.`
                                        : 'This transaction is sponsored by peanut! Enjoy!'
                                }
                            />
                        </label>
                    </div>
                )}
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <button
                    className="wc-disable-mf btn-purple btn-xl "
                    onClick={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                    disabled={isLoading}
                >
                    {!isConnected ? (
                        'Create or Connect Wallet'
                    ) : isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
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
