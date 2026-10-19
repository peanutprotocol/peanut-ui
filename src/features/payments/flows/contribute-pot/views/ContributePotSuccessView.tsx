'use client'

/**
 * success view for contribute pot flow
 *
 * thin wrapper around PaymentSuccessView that:
 * - pulls data from contribute pot flow context
 * - calculates points earned for the contribution
 * - provides reset callback on completion
 *
 * The amount is what the charge booked, not what the payer typed: an
 * external-wallet deposit can arrive short (TASK-23856). A short one shows the
 * partial view with the rest still to send.
 */

import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useContributePotFlow } from '../useContributePotFlow'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import { PointsAction } from '@/services/services.types'
import { useTranslations } from 'next-intl'
import { contributedAmount, isPartialContribution } from '@/utils/request-pot.utils'
import { isChargeAwaitingBooking, receiptStatusForCharge } from '@/features/payments/shared/utils/charge-receipt.utils'
import { PaymentConfirmingView } from '@/features/payments/shared/components/PaymentConfirmingView'
import { ContributePotPartialView } from './ContributePotPartialView'

export function ContributePotSuccessView() {
    const t = useTranslations('payment')
    const {
        usdAmount,
        recipient,
        attachment,
        charge,
        payment,
        resetContributePotFlow,
        isExternalWalletPayment,
        externalDepositAddress,
    } = useContributePotFlow()

    const paidAmount = charge ? contributedAmount(charge) : usdAmount
    // An external-wallet charge the API had not booked when the read-back gave
    // up: nothing is sent yet, so nothing is claimed and no points are estimated.
    const isAwaitingBooking = isExternalWalletPayment && isChargeAwaitingBooking(charge)

    // calculate points for the contribution
    const { pointsData } = usePointsCalculation(
        PointsAction.P2P_REQUEST_PAYMENT,
        paidAmount,
        // For external wallet payments, we dont't have payment info on the FE, its handled by webooks on BE
        (!!payment || isExternalWalletPayment) && !isAwaitingBooking,
        payment?.uuid,
        recipient?.userId
    )

    if (isAwaitingBooking) {
        return (
            <PaymentConfirmingView
                headerTitle={t('headers.contribute')}
                onComplete={resetContributePotFlow}
                redirectTo="/home"
            />
        )
    }

    if (charge && isPartialContribution(charge)) {
        return (
            <ContributePotPartialView
                headerTitle={t('headers.contribute')}
                received={paidAmount}
                asked={charge.tokenAmount}
                depositAddress={externalDepositAddress}
                onComplete={resetContributePotFlow}
                redirectTo="/home"
            />
        )
    }

    return (
        <PaymentSuccessView
            type="SEND"
            headerTitle={t('headers.contribute')}
            recipientType="USERNAME"
            user={
                recipient
                    ? { username: recipient.username, fullName: recipient.fullName, avatarKey: recipient.avatarKey }
                    : undefined
            }
            amount={paidAmount}
            usdAmount={paidAmount}
            message={attachment.message}
            chargeDetails={charge}
            paymentDetails={payment}
            onComplete={resetContributePotFlow}
            redirectTo="/home"
            points={pointsData?.estimatedPoints}
            // only an external-wallet charge was read back after its payment
            receiptStatus={isExternalWalletPayment ? receiptStatusForCharge(charge) : undefined}
        />
    )
}
