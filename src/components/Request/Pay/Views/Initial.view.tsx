import * as _consts from '../Pay.consts'

import { useAccount } from 'wagmi'
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
export const InitialView = ({
    onNext,
    requestLinkData,
    estimatedPoints,
    estimatedGasCost,
    setTransactionHash,
    tokenPrice,
    unsignedTx,
}: _consts.IPayScreenProps) => {
    const { sendTransactions } = useCreateLink()
    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const { selectedTokenPrice, inputDenomination, selectedChainID, selectedTokenAddress } = useContext(
        context.tokenSelectorContext
    )
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const handleConnectWallet = async () => {
        open()
    }

    const handleOnNext = async () => {
        try {
            if (!unsignedTx) return
            // TODO: balance check

            setLoadingState('Sign in wallet')

            const hash = await sendTransactions({
                preparedDepositTxs: { unsignedTxs: [unsignedTx] },
                feeOptions: undefined,
            })
            console.log('hash', hash)

            setLoadingState('Executing transaction')

            const updatedResponse = await peanut.submitRequestLinkFulfillment({
                chainId: requestLinkData.chainId,
                hash: hash ?? '',
                payerAddress: address ?? '',
                link: requestLinkData.link,
                apiUrl: '/api/proxy/patch/',
            })

            console.log('updatedResponse', updatedResponse)
            setTransactionHash(hash ?? '')
            onNext()
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Error while fulfilling the request. Please make sure you have sufficient balance.',
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
                            <label className="text-h8 max-w-full">
                                Ref: <span className="font-normal"> {requestLinkData.reference} </span>
                            </label>
                        )}
                        {requestLinkData.attachmentUrl && (
                            <a
                                href={requestLinkData.attachmentUrl}
                                download
                                target="_blank"
                                className="text-h9 text-gray-1 flex w-full cursor-pointer flex-row items-center justify-center gap-1 font-normal underline "
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
                    <div className="text-h7 flex flex-row items-center justify-center gap-2 pl-1">
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
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                {estimatedGasCost && (
                    <div className="text-h8 text-gray-1 flex w-full flex-row items-center justify-between px-2">
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            <Icon name={'gas'} className="fill-gray-1 h-4" />
                            <label className="font-bold">Fees</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            $0.00 <MoreInfo text={'This transaction is sponsored by peanut! Enjoy!'} />
                        </span>
                    </div>
                )}

                {estimatedPoints && (
                    <div className="text-h8 text-gray-1 flex w-full flex-row items-center justify-between px-2">
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            <Icon name={'plus-circle'} className="fill-gray-1 h-4" />
                            <label className="font-bold">Points</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            +${estimatedPoints}
                            <MoreInfo
                                text={
                                    estimatedPoints
                                        ? estimatedPoints > 0
                                            ? `This transaction will add ${estimatedPoints} to your total points balance.`
                                            : 'This transaction will not add any points to your total points balance'
                                        : 'This transaction will not add any points to your total points balance'
                                }
                            />
                        </span>
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
