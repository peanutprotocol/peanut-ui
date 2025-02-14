import { ParsedURL } from '@/lib/url-parser/types/payment'
import { isAddress } from 'viem'
import { PaymentForm } from '../PaymentForm'

export default function InitialPaymentView(props: ParsedURL) {
    console.log('0x1234...', isAddress('0x1234...'))
    return <PaymentForm {...props} />
}
