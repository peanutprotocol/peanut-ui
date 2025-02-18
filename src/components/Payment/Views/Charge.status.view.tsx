'use client'

import { PEANUTMAN_LOGO } from '@/assets'
import { Button, Card } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Icon from '@/components/Global/Icon'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import Timeline from '@/components/Global/Timeline'
import { fetchDestinationChain } from '@/components/utils/utils'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { formatDate, getExplorerUrl, shortenAddressLong } from '@/utils'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

export default function ChargeStatusView() {
    const { chargeDetails, transactionHash, resolvedAddress } = usePaymentStore()
    const dispatch = useAppDispatch()
    const [isLoading, setIsLoading] = useState(true)
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const [explorerUrlDestChainWithTxHash, setExplorerUrlDestChainWithTxHash] = useState<
        { transactionId: string; transactionUrl: string } | undefined
    >(undefined)

    // get latest payment status based on createdAt
    const latestPayment = useMemo(() => {
        if (!chargeDetails?.payments?.length) return null

        // sort payments by createdAt in descending order and get the first one
        return [...chargeDetails.payments].sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })[0]
    }, [chargeDetails])

    const sourceUrlWithTx = useMemo(() => {
        const txHash =
            chargeDetails?.fulfillmentPayment?.payerTransactionHash ||
            transactionHash ||
            latestPayment?.payerTransactionHash
        const chainId = chargeDetails?.fulfillmentPayment?.payerChainId || chargeDetails?.chainId

        // return URL if both chainId and txHash are available
        if (!chainId || !txHash) return null

        const exporerUrl = getExplorerUrl(chainId)
        const isBlockscoutExplorer = exporerUrl?.includes('blockscout')
        return `${exporerUrl}${isBlockscoutExplorer ? 'tx/' : ''}${txHash}`
    }, [transactionHash, chargeDetails, latestPayment])

    // fetch destination chain details for new payments
    useEffect(() => {
        if (!chargeDetails?.fulfillmentPayment && transactionHash) {
            fetchDestinationChain(transactionHash, setExplorerUrlDestChainWithTxHash)
        }
        setIsLoading(false)
    }, [transactionHash, chargeDetails])

    // polling for status
    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined

        const pollStatus = async () => {
            if (!chargeId) return

            try {
                const updatedCharge = await chargesApi.get(chargeId)
                dispatch(paymentActions.setChargeDetails(updatedCharge))

                // stop polling if payment is in final state
                const currentPayment = updatedCharge.payments?.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )[0] // use latest payment based on createdAt from API response
                if (currentPayment?.status === 'SUCCESSFUL' || currentPayment?.status === 'FAILED') {
                    if (intervalId) {
                        clearInterval(intervalId)
                        intervalId = undefined
                    }
                }
            } catch (error) {
                console.error('Failed to fetch status:', error)
                if (intervalId) {
                    clearInterval(intervalId)
                    intervalId = undefined
                }
            }
        }

        // only start polling if chargeId is available and charge is not in final state
        if (
            chargeId &&
            (!latestPayment || (latestPayment.status !== 'SUCCESSFUL' && latestPayment.status !== 'FAILED'))
        ) {
            // clear any existing interval
            if (intervalId) {
                clearInterval(intervalId)
            }

            // initial poll
            pollStatus()

            // then after every 5 seconds
            intervalId = setInterval(pollStatus, 5000)
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [chargeId, latestPayment?.status])

    const renderTransactionDetails = () => {
        return (
            <>
                <div className="text-h8 font-normal text-gray-1">Transaction details</div>
                <div className="flex w-full flex-row items-center justify-between gap-1">
                    <span>Transaction Hash:</span>
                    {(transactionHash || latestPayment?.payerTransactionHash) && sourceUrlWithTx ? (
                        <Link className="cursor-pointer underline" href={sourceUrlWithTx}>
                            {shortenAddressLong(transactionHash || latestPayment?.payerTransactionHash || '')}
                        </Link>
                    ) : (
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                    )}
                </div>

                {/* Show destination tx skeleton while loading for cross-chain payments */}
                {(explorerUrlDestChainWithTxHash || isLoading) && (
                    <div className="flex w-full flex-row items-center justify-between gap-1">
                        <span>Destination Transaction:</span>
                        {explorerUrlDestChainWithTxHash?.transactionUrl ? (
                            <Link
                                className="cursor-pointer underline"
                                href={explorerUrlDestChainWithTxHash.transactionUrl}
                            >
                                {shortenAddressLong(explorerUrlDestChainWithTxHash.transactionId)}
                            </Link>
                        ) : (
                            <div className="h-4 w-20 animate-pulse bg-gray-200" />
                        )}
                    </div>
                )}
            </>
        )
    }

    const renderHeader = () => {
        // Scenario 1: Just made payment, waiting for confirmation
        if (!latestPayment) {
            return (
                <>
                    <Card.Title>Payment in Progress</Card.Title>
                    <Card.Description className="flex items-center justify-normal gap-2">
                        <div>
                            Your payment to <AddressLink address={resolvedAddress || ''} /> is being processed
                        </div>
                        <div className="animate-spin">
                            <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-4 w-4" />
                        </div>
                    </Card.Description>
                </>
            )
        }

        // Scenario 2: Payment pending
        if (latestPayment && latestPayment.status !== 'FAILED' && latestPayment.status !== 'SUCCESSFUL') {
            return (
                <>
                    <Card.Title>Payment in Progress</Card.Title>
                    <Card.Description className="flex items-center justify-normal gap-2">
                        <div>This might take some time</div>
                        <div className="animate-spin">
                            <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-4 w-4" />
                        </div>
                    </Card.Description>
                </>
            )
        }

        // Scenario 3: Payment failed
        if (latestPayment?.status === 'FAILED') {
            return (
                <>
                    <Card.Title>Payment Failed</Card.Title>
                    <Card.Description>
                        {(latestPayment.reason?.includes('Validation failed after maximum retry attempts') &&
                            'Payment failed due to validation failure') ||
                            'Something went wrong with the payment'}
                    </Card.Description>
                </>
            )
        }

        // Scenario 4: Payment successful (fulfillmentPayment exists)
        if (chargeDetails?.fulfillmentPayment?.status === 'SUCCESSFUL') {
            return (
                <>
                    <Card.Title>Yay!!</Card.Title>
                    <Card.Description>
                        Payment to <AddressLink address={resolvedAddress || ''} /> was successful
                    </Card.Description>
                </>
            )
        }

        return null
    }

    if (!chargeDetails) return null
    return (
        <Card className="w-full shadow-none sm:shadow-primary-4">
            <Card.Header className="border-0 pb-1">{renderHeader()}</Card.Header>

            <Card.Content className="flex w-full flex-col items-start justify-center gap-3 text-h9 font-normal">
                {/* Attachment and Message Section */}
                {(chargeDetails?.requestLink.attachmentUrl || chargeDetails?.requestLink.reference) && (
                    <div className="w-full space-y-2">
                        {chargeDetails?.requestLink.attachmentUrl && (
                            <div className="flex items-center gap-2">
                                <Icon name="paperclip" className="h-4 w-4" />
                                <a
                                    href={`chargeDetails.requestLink.attachmentUrl`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm hover:underline"
                                >
                                    Download Attachment
                                </a>
                            </div>
                        )}
                        {chargeDetails.requestLink.reference && (
                            <div className="flex items-start gap-2">
                                <Icon name="email" className="h-4 w-4 min-w-4" />
                                <p className="text-sm">{chargeDetails.requestLink.reference}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Transaction details section with loading states */}
                <div className="mb-2 w-full space-y-3 border-b border-dashed border-black pb-4">
                    {renderTransactionDetails()}
                </div>

                {/* Timeline for non-successful states */}
                {latestPayment && (
                    <div className="w-full space-y-2">
                        <div className="text-h8 font-semibold text-gray-1">Payment Timeline</div>
                        <div className="py-1">
                            {chargeDetails.timeline.map((entry, index) => (
                                <div key={index} className="">
                                    <Timeline value={`${entry.status}`} label={`${formatDate(new Date(entry.time))}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Discord message */}
                {latestPayment?.status !== 'FAILED' && (
                    <div className="text-h9 font-normal">
                        We would like to hear from your experience. Hit us up on{' '}
                        <a
                            className="cursor-pointer text-black underline dark:text-white"
                            target="_blank"
                            href="https://discord.gg/BX9Ak7AW28"
                        >
                            Discord!
                        </a>
                    </div>
                )}
                {/* todo: refund failed payment */}
            </Card.Content>

            {latestPayment?.status === 'FAILED' ? (
                <div className="px-4 pb-4">
                    <Button onClick={() => dispatch(paymentActions.setView('INITIAL'))} className="w-full">
                        Retry Payment
                    </Button>
                </div>
            ) : (
                <PaymentsFooter
                    variant="transparent-dark"
                    className="mt-3 rounded-none border-x-0 border-t border-black text-black hover:text-black"
                />
            )}
        </Card>
    )
}
