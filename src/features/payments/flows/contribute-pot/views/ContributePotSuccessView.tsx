'use client'

/**
 * success view for contribute pot flow
 *
 * thin wrapper around PaymentSuccessView that:
 * - pulls data from contribute pot flow context
 * - calculates points earned for the contribution
 * - provides reset callback on completion
 */

import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useContributePotFlow } from '../useContributePotFlow'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import { PointsAction } from '@/services/services.types'

export function ContributePotSuccessView() {
    const { usdAmount, recipient, attachment, charge, payment, resetContributePotFlow } = useContributePotFlow()

    // calculate points for the contribution
    const { pointsData } = usePointsCalculation(
        PointsAction.P2P_REQUEST_PAYMENT,
        usdAmount,
        !!payment,
        payment?.uuid,
        recipient?.userId
    )

    return (
        <PaymentSuccessView
            type="SEND"
            headerTitle="Contribute"
            recipientType="USERNAME"
            user={recipient ? { username: recipient.username, fullName: recipient.fullName } : undefined}
            usdAmount={usdAmount}
            message={attachment.message}
            chargeDetails={charge}
            paymentDetails={payment}
            onComplete={resetContributePotFlow}
            redirectTo="/home"
            points={pointsData?.estimatedPoints}
        />
    )
}
