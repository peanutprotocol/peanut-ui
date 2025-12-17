'use client'

// success view for send flow
// uses shared PaymentSuccessView component

import { PaymentSuccessView } from '@/features/payments/shared/components/PaymentSuccessView'
import { useSendFlow } from '../useSendFlow'

export function SendSuccessView() {
    const { amount, usdAmount, recipient, attachment, resetSendFlow } = useSendFlow()

    return (
        <PaymentSuccessView
            type="send"
            amount={usdAmount || amount}
            recipientName={recipient?.fullName || recipient?.username || ''}
            message={attachment.message}
            onReset={resetSendFlow}
        />
    )
}
