import Link from 'next/link'
import * as _consts from '../Pay.consts'
import Icon from '@/components/Global/Icon'
import * as utils from '@/utils'
import { useContext, useEffect, useMemo, useState } from 'react'
import { loopUntilSuccess } from '@/components/utils/utils'
import * as context from '@/context'

export const SuccessView = ({ transactionHash, requestLinkData }: _consts.IPayScreenProps) => {
    const explorerUrlWithTx = useMemo(
        () => `${utils.getExplorerUrl(requestLinkData.chainId)}/tx/${transactionHash}`,
        [transactionHash, requestLinkData.chainId]
    )
    const [explorerUrlDestChainWithTxHash, setExplorerUrlDestChainWithTxHash] = useState<
        { transactionId: string; transactionUrl: string } | undefined
    >(undefined)
    const explorerUrlAxelarWithTx = 'https://axelarscan.io/gmp/' + transactionHash

    const { selectedChainID } = useContext(context.tokenSelectorContext)

    useEffect(() => {
        if (transactionHash) {
            loopUntilSuccess(transactionHash, setExplorerUrlDestChainWithTxHash)
        }
    }, [])
    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Yay!</label>
            <label className="text-h8 font-bold ">
                You have successfully paid{' '}
                {requestLinkData.recipientAddress.endsWith('.eth')
                    ? requestLinkData.recipientAddress
                    : utils.shortenAddressLong(requestLinkData.recipientAddress)}
                !
            </label>
            <div className="flex w-full flex-col items-start justify-center gap-1.5 text-h9 font-normal">
                <label className="text-h8 font-normal text-gray-1">Transaction details</label>
                <div className="flex w-full flex-row items-center justify-start gap-1">
                    <label className="">Source chain:</label>
                    <Link className="cursor-pointer underline" href={explorerUrlWithTx}>
                        {utils.shortenAddressLong(transactionHash ?? '')}
                    </Link>
                </div>
                {requestLinkData.chainId !== selectedChainID && (
                    <>
                        <div className="flex w-full flex-row items-center justify-start gap-1">
                            <label className="">Axelar:</label>
                            <Link className="cursor-pointer underline" href={explorerUrlAxelarWithTx}>
                                {utils.shortenAddressLong(transactionHash ?? '')}
                            </Link>
                        </div>
                        <div className="flex w-full flex-row items-center justify-start gap-1">
                            <label className="">Destination Chain</label>
                            {!explorerUrlDestChainWithTxHash ? (
                                <div className="h-2 w-16 animate-colorPulse rounded bg-slate-700"></div>
                            ) : (
                                <Link
                                    className="cursor-pointer underline"
                                    href={explorerUrlDestChainWithTxHash.transactionUrl}
                                >
                                    {utils.shortenAddressLong(explorerUrlDestChainWithTxHash.transactionId ?? '')}
                                </Link>
                            )}
                        </div>
                    </>
                )}
            </div>
            <label className="text-h9 font-normal">
                We would like to hear from your experience. Hit us up on{' '}
                <a
                    className="cursor-pointer text-black underline dark:text-white"
                    target="_blank"
                    href="https://discord.gg/BX9Ak7AW28"
                >
                    Discord!
                </a>
            </label>
            <Link
                className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                href={'/profile'}
            >
                <div className=" border border-n-1 p-0 px-1">
                    <Icon name="profile" className="-mt-0.5" />
                </div>
                See your payments.
            </Link>
        </div>
    )
}
