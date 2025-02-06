import { useParams, useSearchParams } from 'next/navigation'
import { PaymentForm } from '../PaymentForm'

export default function InitialPaymentView() {
    const params = useParams()
    const searchParams = useSearchParams()
    const recipient = params.recipient as string

    return (
        <PaymentForm
            recipient={recipient}
            amount={searchParams.get('amount')}
            token={searchParams.get('token')}
            chain={searchParams.get('chain')}
        />
    )
}
