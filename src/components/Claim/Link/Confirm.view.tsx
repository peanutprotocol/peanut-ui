'use client'
import Icon from '@/components/Global/Icon'
import { useAccount } from 'wagmi'

import ConfirmDetails from '@/components/Global/ConfirmDetails/Index'

import * as _consts from '../Claim.consts'
import * as utils from '@/utils'
import useClaimLink from '../useClaimLink'
import * as context from '@/context'
import { useContext, useEffect, useState } from 'react'
import Loading from '@/components/Global/Loading'
import MoreInfo from '@/components/Global/MoreInfo'

export const ConfirmClaimLinkView = ({
    onNext,
    onPrev,
    onCustom,
    claimLinkData,
    recipientAddress,
    tokenPrice,
    type,
    setTransactionHash,
    estimatedPoints,
    attachment,
}: _consts.IClaimScreenProps) => {
    const { isConnected, address } = useAccount()
    const { claimLink } = useClaimLink()
    const { setRefetchXchainRoute } = useContext(context.tokenSelectorContext)
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [fileType, setFileType] = useState<string>('')

    const handleOnClaim = async () => {
        setLoadingState('Loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        try {
            let _recipientAddress: string = ''
            if (type === 'address') {
                _recipientAddress = recipientAddress ?? ''
            } else if (type === 'wallet') {
                _recipientAddress = address ?? ''
            }
            setLoadingState('Executing transaction')
            const claimTxHash = await claimLink({
                address: _recipientAddress,
                link: claimLinkData.link,
            })

            if (claimTxHash) {
                utils.saveClaimedLinkToLocalStorage({
                    address: address ?? '',
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
                onCustom('SUCCESS')
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

    useEffect(() => {
        if (attachment?.attachmentUrl) {
            fetch(attachment?.attachmentUrl)
                .then((response) => response.blob())
                .then((blob) => {
                    setFileType(blob.type)
                })
                .catch((error) => {
                    console.error('Error fetching the blob from URL:', error)
                    setFileType('') // Reset or handle the error state
                })
        }
    }, [attachment?.attachmentUrl])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">You're claiming</label>

            <ConfirmDetails
                tokenAmount={claimLinkData.tokenAmount}
                tokenPrice={tokenPrice}
                selectedChainID={claimLinkData.chainId}
                selectedTokenAddress={claimLinkData.tokenAddress}
            />

            {attachment.message || attachment.attachmentUrl ? (
                <>
                    {' '}
                    <div className="flex w-full border-t border-dotted border-black" />
                    <div
                        className={`flex w-full items-center justify-center gap-2 ${utils.checkifImageType(fileType) ? ' flex-row' : ' flex-col'}`}
                    >
                        {attachment.attachmentUrl && utils.checkifImageType(fileType) ? (
                            <img src={attachment.attachmentUrl} className="h-18 w-18" alt="attachment" />
                        ) : (
                            <a
                                href={attachment.attachmentUrl}
                                download
                                target="_blank"
                                className="flex w-full cursor-pointer flex-row items-center justify-center gap-1 text-h8 underline "
                            >
                                <Icon name={'download'} />
                                Download attachment
                            </a>
                        )}
                        {attachment.message && (
                            <label className="text-h8 font-normal text-gray-1">{attachment.message}</label>
                        )}
                    </div>
                    <div className="flex w-full border-t border-dotted border-black" />
                </>
            ) : (
                isConnected &&
                !recipientAddress && (
                    <label className="w-full px-2 text-start text-h8 font-normal">
                        You have successfully connected you wallet. Choose to claim or swap the funds.
                    </label>
                )
            )}

            {recipientAddress && (
                <div className="flex w-full flex-row items-center justify-between px-2 ">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <label className="text-h7 font-normal">To:</label>
                        <label className="text-h7">{utils.shortenAddressLong(recipientAddress)}</label>
                    </div>
                    <label className="cursor-pointer text-h8 font-normal text-purple-1" onClick={onPrev}>
                        Edit
                    </label>
                </div>
            )}

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fees</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        $0.00
                        <MoreInfo text={'This transaction is sponsored by peanut! Enjoy!'} />
                    </span>
                </div>

                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        +{estimatedPoints}
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
                <button
                    className="btn btn-xl dark:border-white dark:text-white"
                    onClick={() => {
                        onNext()
                        setRefetchXchainRoute(false)
                    }}
                >
                    Swap
                </button>
                {isConnected && !recipientAddress && (
                    <label className="cursor-pointer text-h8 font-normal text-purple-1" onClick={onPrev}>
                        Or paste your wallet or ENS address to claim.
                    </label>
                )}

                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ConfirmClaimLinkView
