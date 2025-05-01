'use client'

import AddressLink from '@/components/Global/AddressLink'
import StatusViewWrapper from '@/components/Global/StatusViewWrapper'
import * as consts from '@/constants'
import { ClaimLinkData } from '@/services/sendLinks'
import { formatUnits } from 'viem'

export const AlreadyClaimedLinkView = ({ claimLinkData }: { claimLinkData: ClaimLinkData | undefined }) => {
    const chainName =
        consts.supportedPeanutChains &&
        consts.supportedPeanutChains.find((chain) => chain.chainId == claimLinkData?.chainId)?.name

    const tokenSymbolAvailable: boolean = claimLinkData?.tokenSymbol != undefined
    const tokenAmountAvailable: boolean = claimLinkData?.amount != undefined
    const chainAvailable: boolean = claimLinkData?.chainId != undefined
    const senderAddressAvailable: boolean = claimLinkData?.senderAddress != undefined
    const dataAvailable: boolean =
        tokenSymbolAvailable || tokenAmountAvailable || chainAvailable || senderAddressAvailable

    return (
        <StatusViewWrapper title="Payment Receipt">
            {dataAvailable && (
                <div className="flex w-full flex-col items-start justify-center gap-2">
                    <label className="self-center pb-2 text-h8">This link previously contained:</label>
                    {tokenSymbolAvailable && (
                        <div className="flex w-full flex-row items-center justify-between gap-1 text-h8  text-grey-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1 px-2">
                                <label className="font-bold">Token</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                {claimLinkData?.tokenSymbol}
                            </span>
                        </div>
                    )}
                    {tokenAmountAvailable && (
                        <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8  text-grey-1">
                            <div className="flex w-max  flex-row items-center justify-center gap-1">
                                <label className="font-bold">Amount</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                {formatUnits(claimLinkData?.amount!, claimLinkData?.tokenDecimals!)}
                            </span>
                        </div>
                    )}
                    {chainAvailable && (
                        <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8  text-grey-1">
                            <div className="flex w-max  flex-row items-center justify-center gap-1">
                                <label className="font-bold">Chain</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                <img
                                    src={
                                        consts.supportedPeanutChains.find(
                                            (detail) => detail.chainId === claimLinkData?.chainId
                                        )?.icon.url
                                    }
                                    className="h-6 w-6"
                                />
                                {chainName}
                            </span>
                        </div>
                    )}
                    {senderAddressAvailable && (
                        <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8  text-grey-1">
                            <div className="flex w-max  flex-row items-center justify-center gap-1">
                                <label className="font-bold">Sender</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                <AddressLink address={claimLinkData?.senderAddress ?? ''} />
                            </span>
                        </div>
                    )}
                </div>
            )}
        </StatusViewWrapper>
    )
}
