import Link from 'next/link'
import * as _consts from '../Pay.consts'
import * as assets from '@/assets'
import Icon from '@/components/Global/Icon'
import AddressLink from '@/components/Global/AddressLink'
import * as utils from '@/utils'
import { useContext, useEffect, useMemo, useState } from 'react'
import { fetchDestinationChain } from '@/components/utils/utils'
import * as context from '@/context'
import { peanut } from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'
import { Button, Card } from '@/components/0_Bruddle'

export const SuccessView = ({ transactionHash, requestLinkData, tokenPriceData }: _consts.IPayScreenProps) => {
    const { selectedChainID, selectedTokenAddress } = useContext(context.tokenSelectorContext)
    const { address } = useAccount()
    const [explorerUrlDestChainWithTxHash, setExplorerUrlDestChainWithTxHash] = useState<
        { transactionId: string; transactionUrl: string } | undefined
    >(undefined)
    const { isLoading, setLoadingState, loadingState } = useContext(context.loadingStateContext)

    const sourceUrlWithTx = useMemo(
        () => `${utils.getExplorerUrl(selectedChainID)}/tx/${transactionHash}`,
        [transactionHash, selectedChainID]
    )
    const isXChain = useMemo(() => {
        return requestLinkData.chainId !== selectedChainID
    }, [requestLinkData, selectedChainID])
    const explorerUrlAxelarWithTx = 'https://axelarscan.io/gmp/' + transactionHash

    useEffect(() => {
        if (explorerUrlDestChainWithTxHash) {
            peanut.submitRequestLinkFulfillment({
                chainId: requestLinkData.chainId,
                hash: explorerUrlDestChainWithTxHash.transactionId,
                payerAddress: address ?? '',
                link: requestLinkData.link,
                apiUrl: '/api/proxy/patch/',
                amountUsd: (Number(requestLinkData.tokenAmount) * (tokenPriceData?.price ?? 0)).toFixed(2),
            })
            utils.saveRequestLinkFulfillmentToLocalStorage({
                details: {
                    ...requestLinkData,
                    destinationChainFulfillmentHash: explorerUrlDestChainWithTxHash.transactionId,
                    createdAt: new Date().toISOString(),
                },
                link: requestLinkData.link,
            })
            setLoadingState('Idle')
        }
    }, [explorerUrlDestChainWithTxHash, requestLinkData, address])

    useEffect(() => {
        // is swap on same chain
        if (!isXChain && !utils.areTokenAddressesEqual(selectedTokenAddress, requestLinkData.tokenAddress)) {
            peanut.submitRequestLinkFulfillment({
                chainId: requestLinkData.chainId,
                hash: transactionHash,
                payerAddress: address ?? '',
                link: requestLinkData.link,
                apiUrl: '/api/proxy/patch/',
                amountUsd: (Number(requestLinkData.tokenAmount) * (tokenPriceData?.price ?? 0)).toFixed(2),
            })
            utils.saveRequestLinkFulfillmentToLocalStorage({
                details: {
                    ...requestLinkData,
                    destinationChainFulfillmentHash: transactionHash,
                    createdAt: new Date().toISOString(),
                },
                link: requestLinkData.link,
            })
        }
    }, [isXChain, requestLinkData, transactionHash, address, selectedTokenAddress])

    useEffect(() => {
        if (isXChain) {
            setLoadingState('Awaiting route fulfillment')
            fetchDestinationChain(transactionHash, setExplorerUrlDestChainWithTxHash)
        }
    }, [])
    if (isLoading) {
        return (
            <>
                <div className="animate-spin">
                    <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                    <span className="sr-only">{loadingState}</span>
                </div>

                <label className="text-h8 font-bold ">
                    Funds are on their way to <AddressLink address={requestLinkData.recipientAddress} />!
                </label>
            </>
        )
    }

    return (
        <Card shadowSize="6">
            <Card.Header>
                <Card.Title>Yay !</Card.Title>
                <Card.Description>
                    You have successfully paid <AddressLink address={requestLinkData.recipientAddress} />!
                </Card.Description>
            </Card.Header>
            <Card.Content className="col gap-4">
                <div className="flex w-full flex-col items-start justify-center gap-1.5 text-h9 font-normal">
                    <label className="text-h8 font-normal text-gray-1">Transaction details</label>
                    <div className="flex w-full flex-row items-center justify-start gap-1">
                        <label className="">Source chain:</label>
                        <Link className="cursor-pointer underline" href={sourceUrlWithTx}>
                            {utils.shortenAddressLong(transactionHash ?? '')}
                        </Link>
                    </div>
                    {isXChain && (
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
                <Link href={'/profile'}>
                    <Button variant="stroke">
                        <div className=" border border-n-1 p-0 px-1">
                            <Icon name="profile" className="-mt-0.5" />
                        </div>
                        See your payments.
                    </Button>
                </Link>
            </Card.Content>
        </Card>
    )
}
