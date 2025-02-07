import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentForm } from '../PaymentForm'

export default function InitialPaymentView({ recipient, recipientType, amount, token, chain }: ParsedURL) {
    return <PaymentForm recipient={recipient} amount={amount} token={token} chain={chain} />
}
