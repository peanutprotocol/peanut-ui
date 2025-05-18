import { ParsedURL } from '@/lib/url-parser/types/payment'
import { PaymentForm } from '../PaymentForm'

type InitialPaymentViewProps = ParsedURL & {
    isPintaReq?: boolean
    currency?: {
        code: string
        symbol: string
        price: number
    }
    currencyAmount?: string
    setCurrencyAmount?: (currencyvalue: string | undefined) => void
}

export default function InitialPaymentView(props: InitialPaymentViewProps) {
    const isPintaReq = props.token?.symbol === 'PNT' || props.isPintaReq

    return <PaymentForm {...props} isPintaReq={isPintaReq} />
}
