'use client'
import Icon from '@/components/Global/Icon'
import { useAccount } from 'wagmi'

import ConfirmDetails from '@/components/Global/ConfirmDetails/Index'

import * as _consts from '../Claim.consts'
import * as utils from '@/utils'
import useClaimLink from '../useClaimLink'

export const ConfirmClaimLinkView = ({
    onNext,
    onPrev,
    onCustom,
    claimLinkData,
    recipientAddress,
    tokenPrice,
    type,
}: _consts.IClaimScreenProps) => {
    const { isConnected, address } = useAccount()
    const { claimLink } = useClaimLink()

    const handleOnClaim = async () => {
        let _recipientAddress: string = ''
        if (type === 'address') {
            _recipientAddress = recipientAddress ?? ''
        } else if (type === 'wallet') {
            _recipientAddress = address ?? ''
        }

        const claimTx = await claimLink({
            address: _recipientAddress,
            link: claimLinkData.link,
        })

        if (claimTx) {
            onCustom('SUCCESS')
        } else {
            console.log('Error claiming link')
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
                    <label className="font-normal">+300</label>
                </div>
            </div>

            {isConnected && !recipientAddress && (
                <div className="flex w-full flex-col items-center justify-center gap-2">
                    <button className="btn-purple btn-xl" onClick={handleOnClaim}>
                        Claim
                    </button>
                    <button className="btn btn-xl dark:border-white dark:text-white" onClick={onNext}>
                        Swap
                    </button>
                    <label className="cursor-pointer text-h8 font-normal text-purple-1" onClick={onPrev}>
                        Or paste your wallet or ENS address to claim.
                    </label>
                </div>
            )}

            {recipientAddress && (
                <button className="btn-purple btn-xl" onClick={handleOnClaim}>
                    Claim
                </button>
            )}
        </div>
    )
}

export default ConfirmClaimLinkView
