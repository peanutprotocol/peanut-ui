import { Card } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import { ReferenceAndAttachment } from '@/components/Request/Components/ReferenceAndAttachment'
import { usePaymentStore } from '@/redux/hooks'
import { getExplorerUrl } from '@/utils'

export default function SuccessPaymentView() {
    const { urlParams, requestDetails, transactionHash } = usePaymentStore()

    return (
        <Card className="w-full shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title>Yay!</Card.Title>
                <Card.Description>
                    You have successfully paid <AddressLink address={urlParams?.recipient || ''} />!
                </Card.Description>
            </Card.Header>
            <Card.Content className="col gap-4">
                <ReferenceAndAttachment
                    reference={requestDetails?.reference}
                    attachmentUrl={requestDetails?.attachmentUrl}
                />
                <div className="flex w-full flex-col items-start justify-center gap-1.5 text-h9 font-normal">
                    <label className="text-start text-h8 font-normal text-grey-1">Transaction details</label>
                    <div className="flex w-full flex-row items-center justify-between gap-1">
                        <label>Transaction hash:</label>
                        <a
                            className="cursor-pointer underline"
                            href={`${getExplorerUrl(requestDetails?.chainId as string)}/tx/${transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {transactionHash}
                        </a>
                    </div>
                </div>
                <label className="text-start text-h9 font-normal">
                    We would like to hear from your experience. Hit us up on{' '}
                    <a
                        className="cursor-pointer text-black underline dark:text-white"
                        target="_blank"
                        href="https://discord.gg/BX9Ak7AW28"
                    >
                        Discord!
                    </a>
                </label>
                <PaymentsFooter />
            </Card.Content>
        </Card>
    )
}
