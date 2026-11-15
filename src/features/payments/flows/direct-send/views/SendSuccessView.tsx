'use client'

/**
 * success view for send flow
 *
 * thin wrapper around PaymentSuccessView that:
 * - pulls data from send flow context
 * - calculates points earned for the send
 * - provides reset callback on completion
 */

import { PaymentConfirmingView } from '@/features/payments/shared/components/PaymentConfirmingView'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useDirectSendFlow } from '../useDirectSendFlow'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import { PointsAction } from '@/services/services.types'
import { useTranslations } from 'next-intl'

export function SendSuccessView() {
    const t = useTranslations('payment')
    const { usdAmount, recipient, attachment, charge, payment, resetSendFlow, isSuccess } = useDirectSendFlow()

    // calculate points for the transaction
    const { pointsData } = usePointsCalculation(
        PointsAction.P2P_SEND_LINK,
        usdAmount,
        !!payment && isSuccess,
        payment?.uuid,
        recipient?.userId
    )

    if (!isSuccess) {
        return <PaymentConfirmingView headerTitle={t('headers.send')} onComplete={resetSendFlow} redirectTo="/home" />
    }

    return (
        <PaymentSuccessView
            type="SEND"
            headerTitle={t('headers.send')}
            recipientType="USERNAME"
            recipient={recipient?.person}
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
