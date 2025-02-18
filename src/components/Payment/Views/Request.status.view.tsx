'use client'

import { PEANUTMAN_LOGO } from '@/assets'
import { Button, Card } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Icon from '@/components/Global/Icon'
import InfoRow from '@/components/Global/InfoRow'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import Timeline from '@/components/Global/Timeline'
import { getReadableChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { requestsApi } from '@/services/requests'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'

export default function RequestStatusView() {
    const { requestDetails, resolvedAddress } = usePaymentStore()
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const requestId = searchParams.get('id')

    // get latest charge with payment based on updatedAt
    const latestChargeWithPayment = useMemo(() => {
        if (!requestDetails?.charges?.length) return null

        // filter charges with payments
        const chargesWithPayments = requestDetails.charges.filter((charge) => charge.payments?.length > 0)
        if (!chargesWithPayments.length) return null

        // sort by updatedAt in descending order
        return chargesWithPayments.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
    }, [requestDetails])

    // set charge details in store
    useEffect(() => {
        if (latestChargeWithPayment) {
            dispatch(paymentActions.setChargeDetails(latestChargeWithPayment))
        }
    }, [latestChargeWithPayment, dispatch])

    // polling for request status
    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined

        const pollRequestStatus = async () => {
            if (!requestId) return

            try {
                const updatedRequest = await requestsApi.get(requestId)
                dispatch(paymentActions.setRequestDetails(updatedRequest))

                // find latest payment from the updated request
                const latestCharge = updatedRequest.charges
                    ?.filter((charge) => charge.payments?.length > 0)
                    ?.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]

                const latestPayment = latestCharge?.payments[latestCharge.payments.length - 1]

                // stop polling if payment is in final state
                if (latestPayment?.status === 'SUCCESSFUL' || latestPayment?.status === 'FAILED') {
                    if (intervalId) {
                        clearInterval(intervalId)
                        intervalId = undefined
                    }
                }
            } catch (error) {
                console.error('Failed to fetch request status:', error)
                if (intervalId) {
                    clearInterval(intervalId)
                    intervalId = undefined
                }
            }
        }

        // start polling only if requestId is available and payment not in final status
        const currentPayment = latestChargeWithPayment?.payments[latestChargeWithPayment.payments.length - 1]
        if (
            requestId &&
            (!currentPayment || (currentPayment.status !== 'SUCCESSFUL' && currentPayment.status !== 'FAILED'))
        ) {
            // clear existing interval
            if (intervalId) {
                clearInterval(intervalId)
            }

            // initial poll
            pollRequestStatus()

            // then after every 5 seconds
            intervalId = setInterval(pollRequestStatus, 5000)
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [requestId, latestChargeWithPayment?.payments[0]?.status])

    const renderHeader = () => {
        if (!latestChargeWithPayment) {
            return (
                <>
                    <Card.Title>Payment Required</Card.Title>
                    <Card.Description>No payment has been made yet for this request</Card.Description>
                </>
            )
        }

        const latestPayment = latestChargeWithPayment.payments[latestChargeWithPayment.payments.length - 1]

        // payment is pending
        if (latestPayment.status !== 'FAILED' && latestPayment.status !== 'SUCCESSFUL') {
            return (
                <>
                    <Card.Title>Payment in Progress</Card.Title>
                    <Card.Description className="flex items-center justify-normal gap-2">
                        <div>This might take a some time</div>
                        <div className="animate-spin">
                            <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-4 w-4" />
                        </div>
                    </Card.Description>
                </>
            )
        }

        // payment has failed
        if (latestPayment.status === 'FAILED') {
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

        // payment was successful
        if (latestPayment.status === 'SUCCESSFUL') {
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

    const renderPaymentDetails = () => {
        if (!latestChargeWithPayment) return null

        return (
            <div className="w-full space-y-3">
                <InfoRow
                    label="Payment Amount"
                    value={`${latestChargeWithPayment.tokenAmount} ${latestChargeWithPayment.tokenSymbol}`}
                />

                <InfoRow label="Network" value={getReadableChainName(latestChargeWithPayment.chainId)} />

                <InfoRow
                    label="Recipient"
                    value={
                        latestChargeWithPayment.requestLink.recipientAccount.user?.username || (
                            <AddressLink address={latestChargeWithPayment.requestLink.recipientAddress} />
                        )
                    }
                />
            </div>
        )
    }

    if (!requestDetails) return null

    return (
        <Card className="w-full shadow-none sm:shadow-primary-4">
            <Card.Header className="border-0 pb-1">{renderHeader()}</Card.Header>

            <Card.Content className="flex w-full flex-col items-start justify-center gap-3 text-h9 font-normal">
                {/* Payment Details Section */}
                {renderPaymentDetails()}

                {/* Attachment and Message Section */}
                {latestChargeWithPayment && (
                    <div className="w-full space-y-2">
                        {latestChargeWithPayment.requestLink.attachmentUrl && (
                            <div className="flex items-center gap-2">
                                <Icon name="paperclip" className="h-4 w-4" />
                                <a
                                    href={latestChargeWithPayment.requestLink.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm hover:underline"
                                >
                                    Download Attachment
                                </a>
                            </div>
                        )}
                        {latestChargeWithPayment.requestLink.reference && (
                            <div className="flex items-start gap-2">
                                <Icon name="email" className="h-4 w-4 min-w-4" />
                                <p className="text-sm">{latestChargeWithPayment.requestLink.reference}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Timeline for non-successful states */}
                {latestChargeWithPayment && latestChargeWithPayment.payments[0].status !== 'SUCCESSFUL' && (
                    <div className="w-full space-y-2">
                        <div className="text-h8 font-semibold text-gray-1">Payment Timeline</div>
                        <div className="py-1">
                            {latestChargeWithPayment.timeline.map((entry, index) => (
                                <div key={index} className="">
                                    <Timeline value={`${entry.status}`} label={``} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Discord message for successful payments */}
                {latestChargeWithPayment?.payments[0].status === 'SUCCESSFUL' && (
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
            </Card.Content>

            {latestChargeWithPayment?.payments[0].status === 'FAILED' ? (
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
