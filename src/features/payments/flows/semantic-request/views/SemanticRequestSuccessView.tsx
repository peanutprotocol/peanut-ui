'use client'

import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import { PointsAction } from '@/services/services.types'

export function SemanticRequestSuccessView() {
    const { usdAmount, recipient, parsedUrl, attachment, charge, payment, resetSemanticRequestFlow } =
        useSemanticRequestFlow()

    // determine recipient type from parsed url
    const recipientType = recipient?.recipientType || 'ADDRESS'

    // calculate points for the payment (request fulfillment)
    const { pointsData } = usePointsCalculation(PointsAction.P2P_REQUEST_PAYMENT, usdAmount, !!payment, payment?.uuid)

    return (
        <PaymentSuccessView
            type="SEND"
            headerTitle="Pay"
            recipientType={recipientType}
            usdAmount={usdAmount}
            message={attachment.message}
            chargeDetails={charge}
            paymentDetails={payment}
            parsedPaymentData={parsedUrl}
            onComplete={resetSemanticRequestFlow}
            redirectTo="/home"
            points={pointsData?.estimatedPoints}
        />
    )
}
