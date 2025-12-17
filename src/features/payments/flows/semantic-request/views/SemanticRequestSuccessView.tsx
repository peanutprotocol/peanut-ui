'use client'

// success view for semantic request flow
// uses shared PaymentSuccessView component

import { PaymentSuccessView } from '@/features/payments/shared/components/PaymentSuccessView'
import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { printableAddress } from '@/utils/general.utils'

export function SemanticRequestSuccessView() {
    const { amount, usdAmount, recipient, attachment, resetSemanticRequestFlow } = useSemanticRequestFlow()

    // get recipient display name
    const recipientDisplayName =
        recipient?.recipientType === 'ADDRESS'
            ? printableAddress(recipient.resolvedAddress)
            : recipient?.identifier || ''

    return (
        <PaymentSuccessView
            type="send"
            amount={usdAmount || amount}
            recipientName={recipientDisplayName}
            message={attachment.message}
            onReset={resetSemanticRequestFlow}
        />
    )
}
