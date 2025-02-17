import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentForm } from '../PaymentForm'

export default function InitialPaymentView(props: ParsedURL) {
    return <PaymentForm {...props} />
}
