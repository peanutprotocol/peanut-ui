'use client'

import { PEANUTMAN_LOGO } from '@/assets'
import { Button, Card } from '@/components/0_Bruddle'
import { CrispButton } from '@/components/CrispChat'
import AddressLink from '@/components/Global/AddressLink'
import Icon from '@/components/Global/Icon'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import PeanutLoading from '@/components/Global/PeanutLoading'
import Timeline from '@/components/Global/Timeline'
import { useAuth } from '@/context/authContext'
import { useTranslationViewTransition } from '@/hooks/useTranslationViewTransition'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { formatDate, getExplorerUrl, shortenAddressLong } from '@/utils'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { isAddress } from 'viem'

export default function PaymentStatusView() {
    const { requestDetails, chargeDetails, transactionHash, resolvedAddress } = usePaymentStore()
    const dispatch = useAppDispatch()
    const { userId } = useAuth()
    const searchParams = useSearchParams()
    const requestId = searchParams.get('id')
    const chargeId = searchParams.get('chargeId')
    const isTransitioning = useTranslationViewTransition()

    // get statusDetails based on requestId or chargeId
    const statusDetails = useMemo(() => {
        if (chargeId && chargeDetails) {
            return {
                charge: chargeDetails,
                payments: chargeDetails.payments,
                timeline: chargeDetails.timeline,
                requestLink: chargeDetails.requestLink,
            }
        }
        if (requestId && requestDetails) {
            const latestCharge = requestDetails.charges
                ?.filter((charge) => charge.payments?.length > 0)
                ?.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]

            return latestCharge
                ? {
                      charge: latestCharge,
                      payments: latestCharge.payments,
                      timeline: latestCharge.timeline,
                      requestLink: latestCharge.requestLink,
                  }
                : null
        }
        return null
    }, [chargeId, requestId, chargeDetails, requestDetails])

    // get latest payment details
    const latestPayment = useMemo(() => {
        if (!statusDetails?.payments?.length) return null
        return statusDetails.payments[0]
    }, [statusDetails?.payments])

    const sourceUrlWithTx = useMemo(() => {
        if (!statusDetails || !latestPayment) return null
        const paymentAttempt = statusDetails?.charge.fulfillmentPayment ?? latestPayment
        const txHash = paymentAttempt.payerTransactionHash
        const chainId = paymentAttempt.payerChainId

        if (!chainId || !txHash) return null

        const exporerUrl = getExplorerUrl(chainId)
        return `${exporerUrl}/tx/${txHash}`
    }, [statusDetails?.charge?.fulfillmentPayment, latestPayment])

    const destinationTxAndUrl = useMemo(() => {
        const txHash =
            statusDetails?.charge?.fulfillmentPayment?.fulfillmentTransactionHash ||
            latestPayment?.fulfillmentTransactionHash
        const chainId = requestDetails?.chainId

        if (!chainId || !txHash) return null

        const exporerUrl = getExplorerUrl(chainId)
        const transactionUrl = `${exporerUrl}/tx/${txHash}`
        return { transactionUrl, transactionId: txHash }
    }, [statusDetails, latestPayment, requestDetails])

    // polling for status updates
    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined

        const pollStatus = async () => {
            if (!requestId && !chargeId) return

            try {
                if (requestId) {
                    const updatedRequest = await requestsApi.get(requestId)
                    dispatch(paymentActions.setRequestDetails(updatedRequest))
                } else if (chargeId) {
                    const updatedCharge = await chargesApi.get(chargeId)
                    dispatch(paymentActions.setChargeDetails(updatedCharge))
                }

                // stop polling if payment is in final state
                if (latestPayment?.status === 'SUCCESSFUL' || latestPayment?.status === 'FAILED') {
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

        // pool status if payment is not in final state
        if (
            (requestId || chargeId) &&
            (!latestPayment || (latestPayment.status !== 'SUCCESSFUL' && latestPayment.status !== 'FAILED'))
        ) {
            // initial poll
            pollStatus()

            // poll after every 5 seconds
            intervalId = setInterval(pollStatus, 5000)
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [requestId, chargeId, latestPayment?.status, dispatch])

    const recipientLink = useMemo(() => {
        if (!requestDetails) return null
        // context on resolution logic: https://discord.com/channels/972435984954302464/1351613681867427932/1351632018177392650

        if (requestDetails.recipientAddress) {
            return <AddressLink address={requestDetails.recipientAddress} />
        }

        // Fallback to resolved address (?)
        return resolvedAddress ? <AddressLink address={resolvedAddress} /> : null
    }, [requestDetails, resolvedAddress])

    const payerLink = useMemo(() => {
        if (!latestPayment?.payerAddress) return null

        return <AddressLink address={latestPayment.payerAddress} />
    }, [latestPayment])

    const renderTransactionDetails = () => {
        return (
            <>
                {payerLink && recipientLink && (
                    <>
                        <div className="flex w-full flex-row items-center justify-between gap-1">
                            <label className="text-h9">From:</label>
                            {payerLink}
                        </div>

                        <div className="flex w-full flex-row items-center justify-between gap-1">
                            <label className="text-h9">To:</label>
                            {recipientLink}
                        </div>
                    </>
                )}

                <div className="flex w-full flex-row items-center justify-between gap-1">
                    <label className="text-h9">Transaction Hash:</label>
                    {(transactionHash || latestPayment?.payerTransactionHash) && sourceUrlWithTx ? (
                        <Link
                            className="cursor-pointer underline"
                            href={sourceUrlWithTx}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {shortenAddressLong(transactionHash || latestPayment?.payerTransactionHash || '')}
                        </Link>
                    ) : (
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                    )}
                </div>

                {/* Show destination tx for cross-chain payments */}
                {destinationTxAndUrl && destinationTxAndUrl.transactionId !== transactionHash && (
                    <div className="flex w-full flex-row items-center justify-between gap-1">
                        <label className="text-h9">Destination Transaction:</label>
                        {destinationTxAndUrl?.transactionUrl ? (
                            <Link className="cursor-pointer underline" href={destinationTxAndUrl.transactionUrl}>
                                {shortenAddressLong(destinationTxAndUrl.transactionId)}
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
        // Case1: Just made payment, waiting for confirmation
        if (!latestPayment) {
            return (
                <>
                    <Card.Title className="mx-auto">Payment in Progress</Card.Title>
                    <Card.Description className="mx-auto flex items-center justify-center gap-2">
                        <div>Your payment to {recipientLink} is being processed</div>
                        <div className="animate-spin">
                            <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-4 w-4" />
                        </div>
                    </Card.Description>
                </>
            )
        }

        // Case2: Payment is pending
        if (latestPayment && latestPayment.status !== 'FAILED' && latestPayment.status !== 'SUCCESSFUL') {
            return (
                <>
                    <Card.Title className="mx-auto">Payment in Progress</Card.Title>
                    <Card.Description className="mx-auto flex items-center justify-center gap-2">
                        <div>This might take some time</div>
                        <div className="animate-spin">
                            <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-4 w-4" />
                        </div>
                    </Card.Description>
                </>
            )
        }

        // Case3: Payment has failed
        if (latestPayment?.status === 'FAILED') {
            return (
                <>
                    <Card.Title className="mx-auto">Payment Failed</Card.Title>
                    <Card.Description className="mx-auto">
                        {(latestPayment.reason?.includes('Validation failed after maximum retry attempts') &&
                            'Payment failed due to validation failure') ||
                            'Something went wrong with the payment'}
                    </Card.Description>
                </>
            )
        }

        // Case4: Payment was successful
        if (statusDetails?.charge?.fulfillmentPayment?.status === 'SUCCESSFUL') {
            return (
                <>
                    <Card.Title className="mx-auto">Yay!!</Card.Title>
                    <Card.Description className="mx-auto">Payment to {recipientLink} was successful</Card.Description>
                </>
            )
        }

        return null
    }

    if (isTransitioning) {
        return <PeanutLoading />
    }

    if (!statusDetails) return null

    return (
        <Card className="w-full shadow-none sm:shadow-primary-4">
            <Card.Header className="border-0 pb-1">{renderHeader()}</Card.Header>

            <Card.Content className="flex w-full flex-col items-start justify-center gap-3 text-h9 font-normal">
                {/* Attachment and Message Section */}
                {(statusDetails.requestLink.attachmentUrl || statusDetails.requestLink.reference) && (
                    <div className="w-full space-y-2">
                        {statusDetails.requestLink.attachmentUrl && (
                            <div className="flex items-center gap-2">
                                <Icon name="paperclip" className="h-4 w-4" />
                                <a
                                    href={statusDetails.requestLink.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm hover:underline"
                                >
                                    Download Attachment
                                </a>
                            </div>
                        )}
                        {statusDetails.requestLink.reference && (
                            <div className="flex items-start justify-center gap-2">
                                <Icon name="email" className="mt-0.5 h-4 w-4 min-w-4" />
                                <p className="text-sm">{statusDetails.requestLink.reference}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Transaction details section */}
                <div className="mb-2 w-full space-y-3 border-b border-dashed border-black pb-4 pt-2">
                    {renderTransactionDetails()}
                </div>

                {/* Timeline */}
                {latestPayment && (
                    <div className="w-full space-y-2">
                        <div className="text-h8 font-semibold text-gray-1">Payment Timeline</div>
                        <div className="py-1">
                            {statusDetails.timeline.map((entry, index) => (
                                <div key={index}>
                                    <Timeline value={`${entry.status}`} label={`${formatDate(new Date(entry.time))}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Discord message */}
                {latestPayment?.status !== 'FAILED' && (
                    <div className="mx-auto text-h9 font-normal">
                        We would like to hear from your experience.{' '}
                        <CrispButton className="text-black underline dark:text-white">Chat with support</CrispButton>
                    </div>
                )}
            </Card.Content>

            {latestPayment?.status === 'FAILED' ? (
                <div className="px-4 pb-4">
                    <Button onClick={() => dispatch(paymentActions.setView('INITIAL'))} className="w-full">
                        Retry Payment
                    </Button>
                </div>
            ) : (
                <PaymentsFooter
                    href={userId ? undefined : '/setup'}
                    text={userId ? undefined : 'Sign up to see payments'}
                    className="mt-3 rounded-none border-x-0 border-t border-black text-black hover:text-black"
                />
            )}
        </Card>
    )
}
