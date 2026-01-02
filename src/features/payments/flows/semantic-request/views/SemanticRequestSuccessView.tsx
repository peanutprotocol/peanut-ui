'use client'

/**
 * success view for semantic request flow
 *
 * thin wrapper around PaymentSuccessView that:
 * - pulls data from semantic request flow context
 * - calculates points earned for the payment
 * - provides reset callback on completion
 */

import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import { PointsAction } from '@/services/services.types'

export function SemanticRequestSuccessView() {
    const {
        usdAmount,
        recipient,
        parsedUrl,
        attachment,
        charge,
        payment,
        resetSemanticRequestFlow,
        isExternalWalletPayment,
    } = useSemanticRequestFlow()

    // determine recipient type from parsed url
    const recipientType = recipient?.recipientType || 'ADDRESS'

    // calculate points for the payment (request fulfillment)
    const { pointsData } = usePointsCalculation(
        PointsAction.P2P_REQUEST_PAYMENT,
        usdAmount,
        !!payment || isExternalWalletPayment, // For external wallet payments, we dont't have payment info on the FE, its handled by webooks on BE
        payment?.uuid
    )

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
