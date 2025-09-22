import { PaymentForm, PaymentFormProps } from '../PaymentForm'

export default function InitialPaymentView(props: PaymentFormProps) {
    return (
        <PaymentForm
            {...props}
            isExternalWalletFlow={props.isExternalWalletFlow}
            isDirectUsdPayment={props.isDirectUsdPayment}
        />
    )
}
