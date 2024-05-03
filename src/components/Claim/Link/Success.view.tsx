import Icon from '@/components/Global/Icon'
import * as _consts from '../Claim.consts'
import * as utils from '@/utils'
import * as consts from '@/constants'
import * as context from '@/context'
import useClaimLink from '../useClaimLink'
import { useContext, useMemo } from 'react'
import Link from 'next/link'

export const SuccessClaimLinkView = ({ onNext, transactionHash }: _consts.IClaimScreenProps) => {
    const { selectedChainID } = useContext(context.tokenSelectorContext)

    const explorerUrlWithTx = useMemo(
        () =>
            `${consts.supportedPeanutChains.find((detail) => detail.chainId === selectedChainID)?.explorers[0].url}/tx/${transactionHash}`,
        [transactionHash, selectedChainID]
    )
    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Yay!</label>
            <label className="text-h8 font-bold ">You have successfully claimed your funds!</label>
            <div className="flex w-full flex-col items-start justify-center gap-1.5">
                <label className="text-h8 font-normal">Transaction details</label>
                <div className="flex w-full flex-row items-center justify-start gap-1">
                    <label className="text-h9">Transaction hash:</label>
                    <Link className="cursor-pointer text-h9 font-normal underline" href={explorerUrlWithTx}>
                        {utils.shortenAddressLong(transactionHash ?? '')}
                    </Link>
                </div>
            </div>
            <label className="text-h9 font-normal">
                We would like to hear from your experience. Hit us up on{' '}
                <a className="cursor-pointer text-black underline dark:text-white">Discord!</a>
            </label>
            <div className="absolute bottom-0 -mb-0.5 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border border-black border-n-1 bg-purple-3  px-4.5 dark:text-black">
                <div className="cursor-pointer border border-n-1 p-0 px-1">
                    <Icon name="like" className="-mt-0.5" />
                </div>
                <label className=" text-sm font-bold">Check out all the links you have claimed</label>
            </div>
        </div>
    )
}

export default SuccessClaimLinkView
