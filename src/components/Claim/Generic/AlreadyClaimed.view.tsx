'use client'

import Icon from '@/components/Global/Icon'
import * as _consts from '../Claim.consts'
import * as consts from '@/constants'
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card } from '@/components/0_Bruddle'

export const AlreadyClaimedLinkView = ({ claimLinkData }: { claimLinkData: interfaces.ILinkDetails | undefined }) => {
    const router = useRouter()

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
        <Card shadowSize="6">
            <Card.Header>
                <Card.Title>Sorry, this link has been claimed already.</Card.Title>
                <Card.Description></Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-2">
                {dataAvailable && (
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <label className="text-h8 ">This link previously contained:</label>
                        {tokenSymbolAvailable && (
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                <div className="flex w-max  flex-row items-center justify-center gap-1">
                                    <label className="font-bold">Token</label>
                                </div>
                                <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    {claimLinkData?.tokenSymbol}
                                </span>
                            </div>
                        )}
                        {tokenAmountAvailable && (
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                <div className="flex w-max  flex-row items-center justify-center gap-1">
                                    <label className="font-bold">Amount</label>
                                </div>
                                <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    {claimLinkData?.tokenAmount}
                                </span>
                            </div>
                        )}
                        {chainAvailable && (
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
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
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                <div className="flex w-max  flex-row items-center justify-center gap-1">
                                    <label className="font-bold">Sender</label>
                                </div>
                                <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    {utils.shortenAddress(claimLinkData?.senderAddress)}
                                </span>
                            </div>
                        )}
                    </div>
                )}
                <Link className="" href={'/send'}>
                    <Button variant="stroke" className="text-nowrap">
                        <div className="border border-n-1 p-0 px-1">
                            <Icon name="send" className="-mt-0.5" />
                        </div>
                        Make a payment yourself !
                    </Button>
                </Link>
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
            </Card.Content>
        </Card>
    )
}

export default AlreadyClaimedLinkView
