import { PaymentForm, PaymentFormProps } from '../PaymentForm'

export default function InitialPaymentView(props: PaymentFormProps) {
    const isPintaReq = props.token?.symbol === 'PNT' || props.isPintaReq

    return (
        <PaymentForm
            {...props}
            isPintaReq={isPintaReq}
            isAddMoneyFlow={props.isAddMoneyFlow}
            isWithdrawFlow={props.isWithdrawFlow}
        />
    )
}
