import { Card } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import { ReferenceAndAttachment } from '@/components/Request/Components/ReferenceAndAttachment'
import { Payment, RequestCharge, TimelineEntry } from '@/services/services.types'
import { formatDate, getChainName, getExplorerUrl, printableAddress } from '@/utils'

interface PaymentTimelineProps {
    charge: RequestCharge
}

// todo: rethink this, could be a lot of payments + timeline entries, better show in a modal when clicked on the payment history
export default function PaymentTimeline({ charge }: PaymentTimelineProps) {
    const latestPayment: Payment | undefined = charge.payments[charge.payments.length - 1]

    const timelineStatuses: Record<TimelineEntry['status'], string> = {
        NEW: 'Request Created',
        PENDING: 'Payment Processing',
        COMPLETED: 'Payment Completed',
        FAILED: 'Payment Failed',
        SIGNED: 'Payment Signed',
        EXPIRED: 'Payment Expired',
    }

    const getTimelineStatusColor = (status: TimelineEntry['status']): string => {
        switch (status) {
            case 'COMPLETED':
                return 'bg-green-500'
            case 'FAILED':
                return 'bg-red-500'
            case 'EXPIRED':
                return 'bg-red-500'
            case 'PENDING':
                return 'bg-yellow-500'
            default:
                return 'bg-blue-500'
        }
    }

    return (
        <Card className="w-full shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title>Payment Status</Card.Title>
                <Card.Description>
                    Payment to <AddressLink address={charge.requestLink.recipientAddress} />
                </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
                <div className="w-full self-start text-start">
                    <ReferenceAndAttachment
                        reference={charge.requestLink.reference}
                        attachmentUrl={charge.requestLink.attachmentUrl}
                    />
                </div>

                {/* Payment Details */}
                <div className="flex w-full flex-col gap-3">
                    <div className="text-h8 font-semibold text-grey-1">Payment Details</div>
                    <div className="flex flex-col gap-2 text-sm">
                        {/* Amount */}
                        <div className="flex justify-between">
                            <span className="text-grey-1">Amount</span>
                            <span className="font-medium">
                                {charge.tokenAmount} {charge.tokenSymbol}
                            </span>
                        </div>

                        {/* Chain */}
                        <div className="flex justify-between">
                            <span className="text-grey-1">Chain</span>
                            <span className="font-medium capitalize">
                                {getChainName(latestPayment?.payerChainId || charge.chainId)}
                            </span>
                        </div>

                        {/* Transaction Hash */}
                        {latestPayment?.payerTransactionHash && (
                            <div className="flex justify-between">
                                <span className="text-grey-1">Transaction</span>
                                <a
                                    href={`${getExplorerUrl(latestPayment.payerChainId)}/tx/${latestPayment.payerTransactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium hover:underline"
                                >
                                    {printableAddress(latestPayment.payerTransactionHash)}
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* Timeline */}
                <div className="flex w-full flex-col gap-3">
                    <div className="text-h8 font-semibold text-grey-1">Timeline</div>
                    <div className="flex flex-col gap-2">
                        {charge.timeline.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${getTimelineStatusColor(entry.status)}`} />
                                <div className="flex flex-1 justify-between text-sm">
                                    <span className="text-grey-1">{timelineStatuses[entry.status]}</span>
                                    <span className="text-grey-1">{formatDate(new Date(entry.time))}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <PaymentsFooter />
            </Card.Content>
        </Card>
    )
}
