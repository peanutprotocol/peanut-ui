'use client'
import Icon from '@/components/Global/Icon'
import { useAccount } from 'wagmi'

import ConfirmDetails from '@/components/Global/ConfirmDetails/Index'

import * as _consts from '../Claim.consts'
import * as utils from '@/utils'
import useClaimLink from '../useClaimLink'
import * as context from '@/context'
import { useContext, useState } from 'react'
import Loading from '@/components/Global/Loading'

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
}: _consts.IClaimScreenProps) => {
    const { isConnected, address } = useAccount()
    const { claimLink } = useClaimLink()
    const { setRefetchXchainRoute } = useContext(context.tokenSelectorContext)
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

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
                console.log(address)
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
    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">You're claiming</label>

            <ConfirmDetails
                tokenAmount={claimLinkData.tokenAmount}
                tokenPrice={tokenPrice}
                selectedChainID={claimLinkData.chainId}
                selectedTokenAddress={claimLinkData.tokenAddress}
            />

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
            {isConnected && !recipientAddress && (
                <label className="w-full px-2 text-start text-h8 font-normal">
                    You have successfully connected you wallet. Choose to claim or swap the funds.
                </label>
            )}

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fees</label>
                    </div>
                    <label className="font-normal">$0.00</label>
                </div>

                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <label className="font-normal">+{estimatedPoints}</label>
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
                        <label className=" text-h8 text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ConfirmClaimLinkView
