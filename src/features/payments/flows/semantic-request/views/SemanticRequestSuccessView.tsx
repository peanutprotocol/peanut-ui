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
import { useTranslations } from 'next-intl'
import { contributedAmount } from '@/utils/request-pot.utils'
import { isStableCoin } from '@/utils/general.utils'
import { isChargeAwaitingBooking, receiptStatusForCharge } from '@/features/payments/shared/utils/charge-receipt.utils'
import { PaymentConfirmingView } from '@/features/payments/shared/components/PaymentConfirmingView'

export function SemanticRequestSuccessView() {
    const t = useTranslations('payment')

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

    // An external-wallet deposit can arrive short of the charge (TASK-23856):
    // the charge read back after the deposit states what was booked. That
    // figure is in the charge's token, so it stands in for dollars only on a
    // dollar stablecoin.
    const bookedUsd =
        isExternalWalletPayment && charge && isStableCoin(charge.tokenSymbol) ? contributedAmount(charge) : undefined
    const paidUsd = bookedUsd ?? usdAmount
    // An external-wallet charge the API had not booked when the read-back gave
    // up: nothing is sent yet, so nothing is claimed and no points are estimated.
    const isAwaitingBooking = isExternalWalletPayment && isChargeAwaitingBooking(charge)

    // calculate points for the payment (request fulfillment)
    const { pointsData } = usePointsCalculation(
        PointsAction.P2P_REQUEST_PAYMENT,
        paidUsd,
        // For external wallet payments, we dont't have payment info on the FE, its handled by webooks on BE
        (!!payment || isExternalWalletPayment) && !isAwaitingBooking,
        payment?.uuid
    )

    if (isAwaitingBooking) {
        return (
            <PaymentConfirmingView
                headerTitle={t('headers.pay')}
                onComplete={resetSemanticRequestFlow}
                redirectTo="/home"
            />
        )
    }

    return (
        <PaymentSuccessView
            type="SEND"
            headerTitle={t('headers.pay')}
            recipientType={recipientType}
            amount={bookedUsd}
            usdAmount={paidUsd}
            message={attachment.message}
            chargeDetails={charge}
            paymentDetails={payment}
            parsedPaymentData={parsedUrl}
            onComplete={resetSemanticRequestFlow}
            redirectTo="/home"
            points={pointsData?.estimatedPoints}
            // only an external-wallet charge was read back after its payment
            receiptStatus={isExternalWalletPayment ? receiptStatusForCharge(charge) : undefined}
        />
    )
}
