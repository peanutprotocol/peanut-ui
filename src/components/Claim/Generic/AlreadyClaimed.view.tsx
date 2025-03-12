'use client'

import { Card } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import { CrispButton } from '@/components/CrispChat'
import * as consts from '@/constants'
import * as interfaces from '@/interfaces'

export const AlreadyClaimedLinkView = ({ claimLinkData }: { claimLinkData: interfaces.ILinkDetails | undefined }) => {
    const chainName =
        consts.supportedPeanutChains &&
        consts.supportedPeanutChains.find((chain) => chain.chainId == claimLinkData?.chainId)?.name

    const tokenSymbolAvailable: boolean = claimLinkData?.tokenSymbol != undefined
    const tokenAmountAvailable: boolean = claimLinkData?.tokenAmount != undefined
    const chainAvailable: boolean = claimLinkData?.chainId != undefined
    const senderAddressAvailable: boolean = claimLinkData?.senderAddress != undefined
    const dataAvailable: boolean =
        tokenSymbolAvailable || tokenAmountAvailable || chainAvailable || senderAddressAvailable

    return (
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title className="mx-auto text-center">Payment Receipt</Card.Title>
                <Card.Description></Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-2">
                {dataAvailable && (
                    <div className="flex w-full flex-col items-start justify-center gap-2 py-2">
                        <label className="text-h8">This link previously contained:</label>
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
                                    {claimLinkData?.tokenAmount}
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
                <label className="text-start text-h9 font-normal">
                    We would like to hear from your experience.{' '}
                    <CrispButton className="text-black underline dark:text-white">Chat with support</CrispButton>
                </label>
                <PaymentsFooter />
            </Card.Content>
        </Card>
    )
}
