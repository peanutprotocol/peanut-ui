import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentForm } from '../PaymentForm'

export default function InitialPaymentView(props: ParsedURL & { isPintaReq?: boolean }) {
    const isPintaReq = props.token?.symbol === 'PNT' || props.isPintaReq

    return (
        <div>
            <PaymentForm {...props} isPintaReq={isPintaReq} />
        </div>
    )
}
