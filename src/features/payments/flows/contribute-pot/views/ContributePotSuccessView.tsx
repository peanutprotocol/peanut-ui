'use client'

// success view for contribute pot flow
// uses shared PaymentSuccessView component

import { PaymentSuccessView } from '@/features/payments/shared/components/PaymentSuccessView'
import { useContributePotFlow } from '../useContributePotFlow'

export function ContributePotSuccessView() {
    const { amount, usdAmount, recipient, attachment, resetContributePotFlow } = useContributePotFlow()

    return (
        <PaymentSuccessView
            type="contribute"
            amount={usdAmount || amount}
            recipientName={recipient?.username || ''}
            message={attachment.message}
            onReset={resetContributePotFlow}
        />
    )
}
