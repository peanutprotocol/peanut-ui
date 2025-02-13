import { Card } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import { ReferenceAndAttachment } from '@/components/Request/Components/ReferenceAndAttachment'
import { usePaymentStore } from '@/redux/hooks'
import { getChainName, getExplorerUrl, shortenAddress } from '@/utils'

export default function SuccessPaymentView() {
    const { urlParams, requestDetails, paymentDetails } = usePaymentStore()

    if (!paymentDetails) {
        return <div>Loading...</div>
    }

    return (
        <Card className="w-full shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title>Payment Successful!</Card.Title>
                <Card.Description>
                    You have successfully paid <AddressLink address={urlParams?.recipient || ''} />
                </Card.Description>
            </Card.Header>
            <Card.Content className="col gap-4">
                <ReferenceAndAttachment
                    reference={requestDetails?.reference}
                    attachmentUrl={requestDetails?.attachmentUrl}
                />

                {/* Payment Details */}
                <div className="flex w-full flex-col gap-3">
                    <div className="text-h8 font-semibold text-grey-1">Payment Details</div>

                    <div className="flex flex-col gap-2 text-sm">
                        {/* Amount */}
                        <div className="flex justify-between">
                            <span className="text-grey-1">Amount</span>
                            <span className="font-medium">
                                {paymentDetails.requestCharge.tokenAmount} {urlParams?.token}
                            </span>
                        </div>

                        {/* Chain */}
                        <div className="flex justify-between">
                            <span className="text-grey-1">Chain</span>
                            <span className="font-medium capitalize">{getChainName(paymentDetails.payerChainId)}</span>
                        </div>

                        {/* Transaction Hash */}
                        <div className="flex justify-between">
                            <span className="text-grey-1">Transaction</span>
                            <a
                                href={`${getExplorerUrl(paymentDetails.payerChainId)}/tx/${paymentDetails.payerTransactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 hover:underline"
                            >
                                {shortenAddress(paymentDetails.payerTransactionHash)}
                            </a>
                        </div>

                        {/* Recipient */}
                        <div className="flex justify-between">
                            <span className="text-grey-1">Recipient</span>
                            <AddressLink address={paymentDetails.requestCharge.requestLink.recipientAddress} />
                        </div>
                    </div>
                </div>

                <div className="mt-4 text-sm text-grey-1">
                    We would love to hear about your experience! Join us on{' '}
                    <a
                        className="font-medium text-black hover:underline dark:text-white"
                        target="_blank"
                        href="https://discord.gg/BX9Ak7AW28"
                    >
                        Discord
                    </a>
                </div>

                <PaymentsFooter />
            </Card.Content>
        </Card>
    )
}
