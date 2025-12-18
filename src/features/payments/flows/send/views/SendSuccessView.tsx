'use client'

// success view for send flow
// uses PaymentSuccessView for consistent ui and features (drawer, points, etc.)

import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useSendFlow } from '../useSendFlow'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import { PointsAction } from '@/services/services.types'

export function SendSuccessView() {
    const { usdAmount, recipient, attachment, charge, payment, resetSendFlow } = useSendFlow()

    // calculate points for the transaction
    const { pointsData } = usePointsCalculation(
        PointsAction.P2P_SEND_LINK,
        usdAmount,
        !!payment,
        payment?.uuid,
        recipient?.userId
    )

    return (
        <PaymentSuccessView
            type="SEND"
            headerTitle="Send"
            recipientType="USERNAME"
            user={recipient ? { username: recipient.username, fullName: recipient.fullName } : undefined}
            usdAmount={usdAmount}
            message={attachment.message}
            chargeDetails={charge}
            paymentDetails={payment}
            onComplete={resetSendFlow}
            redirectTo="/home"
            points={pointsData?.estimatedPoints}
        />
    )
}
