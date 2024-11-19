'use client'
import Icon from '@/components/Global/Icon'
import AddressLink from '@/components/Global/AddressLink'
import { useAccount } from 'wagmi'

import * as _consts from '../../Claim.consts'
import * as utils from '@/utils'
import useClaimLink from '../../useClaimLink'
import * as context from '@/context'
import { useContext, useState } from 'react'
import Loading from '@/components/Global/Loading'
import MoreInfo from '@/components/Global/MoreInfo'
import * as _interfaces from '../../Claim.interfaces'
import * as _utils from '../../Claim.utils'
import * as consts from '@/constants'
import { useBalance } from '@/hooks/useBalance'

export const ConfirmClaimLinkView = ({
    onNext,
    onPrev,
    setClaimType,
    claimLinkData,
    recipient,
    tokenPrice,
    setTransactionHash,
    estimatedPoints,
    attachment,
    selectedRoute,
    crossChainDetails,
}: _consts.IClaimScreenProps) => {
    const { address } = useAccount()
    const { claimLinkXchain, claimLink } = useClaimLink()
    const { selectedChainID, selectedTokenAddress } = useContext(context.tokenSelectorContext)
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [fileType] = useState<string>('')
    const mappedData: _interfaces.CombinedType[] = _utils.mapToIPeanutChainDetailsArray(crossChainDetails)
    const { refetchBalances } = useBalance()

    const handleOnClaim = async () => {
        if (!recipient) {
            return
        }

        setLoadingState('Loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        try {
            let claimTxHash = ''
            if (selectedRoute) {
                claimTxHash = await claimLinkXchain({
                    address: recipient ? recipient.address : (address ?? ''),
                    link: claimLinkData.link,
                    destinationChainId: selectedChainID,
                    destinationToken: selectedTokenAddress,
                })
                setClaimType('claimxchain')
            } else {
                claimTxHash = await claimLink({
                    address: recipient ? recipient.address : (address ?? ''),
                    link: claimLinkData.link,
                })
                setClaimType('claim')
            }
            if (claimTxHash) {
                utils.saveClaimedLinkToLocalStorage({
                    address: recipient ? recipient.address : (address ?? ''),
                    data: {
                        ...claimLinkData,
                        depositDate: new Date(),
                        USDTokenPrice: tokenPrice,
                        points: estimatedPoints,
                        txHash: claimTxHash,
                        message: attachment.message ? attachment.message : undefined,
                        attachmentUrl: attachment.attachmentUrl ? attachment.attachmentUrl : undefined,
                    },
                })
                setTransactionHash(claimTxHash)
                onNext()
                refetchBalances()
            } else {
                throw new Error('Error claiming link')
            }
        } catch (error) {
            const errorString = utils.ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    // useEffect(() => {
    //     if (attachment?.attachmentUrl) {
    //         try {
    //             fetch(attachment?.attachmentUrl)
    //                 .then((response) => response.blob())
    //                 .then((blob) => {
    //                     setFileType(blob.type)
    //                 })
    //                 .catch((error) => {
    //                     console.error('Error fetching the blob from URL:', error)
    //                     setFileType('') // Reset or handle the error state
    //                 })
    //         } catch (error) {}
    //     }
    // }, [attachment?.attachmentUrl])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            {(attachment.message || attachment.attachmentUrl) && (
                <>
                    <div
                        className={`flex w-full items-center justify-center gap-2 ${utils.checkifImageType(fileType) ? ' flex-row' : ' flex-col'}`}
                    >
                        {attachment.message && <label className="text-h8 ">{attachment.message}</label>}
                        {attachment.attachmentUrl && utils.checkifImageType(fileType) ? (
                            <img src={attachment.attachmentUrl} className="h-18 w-18" alt="attachment" />
                        ) : (
                            <a
                                href={attachment.attachmentUrl}
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
                <label className="text-h4">{utils.shortenAddress(claimLinkData.senderAddress)} sent you</label>
                {tokenPrice ? (
                    selectedRoute ? (
                        <label className="text-h2">
                            ${' '}
                            {utils.formatTokenAmount(
                                utils.formatAmountWithDecimals({
                                    amount: selectedRoute.route.estimate.toAmountMin,
                                    decimals: selectedRoute.route.estimate.toToken.decimals,
                                }) * selectedRoute.route.estimate.toToken.usdPrice
                            )}
                        </label>
                    ) : (
                        <label className="text-h2">
                            $ {utils.formatTokenAmount(Number(claimLinkData.tokenAmount) * tokenPrice)}
                        </label>
                    )
                ) : (
                    <label className="text-h2 ">
                        {claimLinkData.tokenAmount} {claimLinkData.tokenSymbol}
                    </label>
                )}
                {selectedRoute ? (
                    <div className="flex w-full flex-row items-start justify-center gap-1 text-h7">
                        {utils.formatTokenAmount(
                            utils.formatAmountWithDecimals({
                                amount: selectedRoute.route.estimate.toAmountMin,
                                decimals: selectedRoute.route.estimate.toToken.decimals,
                            })
                        )}{' '}
                        {selectedRoute.route.estimate.toToken.symbol} on{' '}
                        {mappedData.find((chain) => chain.chainId === selectedRoute.route.params.toChain)?.name}
                    </div>
                ) : (
                    <div className="flex w-full flex-row items-start justify-center gap-1 text-h7">
                        {utils.formatTokenAmount(Number(claimLinkData.tokenAmount))} {claimLinkData.tokenSymbol} on{' '}
                        {consts.supportedPeanutChains.find((chain) => chain.chainId === claimLinkData.chainId)?.name}
                    </div>
                )}
            </div>

            <div className="flex w-full flex-row items-center justify-start gap-1 px-2">
                <label className="text-h7 font-normal">Claiming to:</label>
                <span className="flex items-center gap-1 ">
                    <label className="text-h7">
                        <AddressLink address={recipient.name ?? recipient.address ?? ''} />
                    </label>
                    {recipient.name && <MoreInfo text={`You will be claiming to ${recipient.address}`} />}
                </span>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                {selectedRoute && (
                    <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            <Icon name={'forward'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Route</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            {selectedRoute && (
                                <>
                                    {
                                        consts.supportedPeanutChains.find(
                                            (chain) => chain.chainId === selectedRoute.route.params.fromChain
                                        )?.name
                                    }
                                    <Icon name={'arrow-next'} className="h-4 fill-gray-1" />{' '}
                                    {
                                        mappedData.find((chain) => chain.chainId === selectedRoute.route.params.toChain)
                                            ?.name
                                    }
                                    <MoreInfo
                                        text={`You are bridging ${claimLinkData.tokenSymbol.toLowerCase()} on ${
                                            consts.supportedPeanutChains.find(
                                                (chain) => chain.chainId === selectedRoute.route.params.fromChain
                                            )?.name
                                        } to ${selectedRoute.route.estimate.toToken.symbol.toLowerCase()} on  ${
                                            mappedData.find(
                                                (chain) => chain.chainId === selectedRoute.route.params.toChain
                                            )?.name
                                        }.`}
                                    />
                                </>
                            )}
                        </span>
                    </div>
                )}

                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fees</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        $0.00 <MoreInfo text={'This transaction is sponsored by peanut! Enjoy!'} />
                    </span>
                </div>

                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {estimatedPoints < 0 ? estimatedPoints : `+${estimatedPoints}`}
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
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button className="btn-purple btn-xl" onClick={handleOnClaim} disabled={isLoading}>
                    {isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (
                        'Claim'
                    )}
                </button>
                <button className="btn btn-xl dark:border-white dark:text-white" onClick={onPrev} disabled={isLoading}>
                    Return
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

