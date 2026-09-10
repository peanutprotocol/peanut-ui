'use client'

import { useMemo } from 'react'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { EQrType } from '@/components/Global/DirectSendQR/utils'
import { MIN_PIX_AMOUNT_BRL } from '@/constants/payment.consts'
import { QR_INIT_CODE, type QrScanFailure } from './init-error-classifier'

/**
 * The localized copy for every `/manteca/qr-payment/init` refusal, keyed by the
 * classifier's failure table so the copy and the retry gate cannot drift.
 */
export function useQrFailureCopy(qrType: string | null, qrMethodName: string) {
    const t = useAppTranslations('qrPay')

    // Shown wherever the backend rejects a Pix payment below the rail minimum
    // (typed 400 PIX_MIN_AMOUNT — fires at lock-init for merchant-encoded amounts
    // and at re-init for user-entered amounts on open-amount QRs).
    const pixMinAmountErrorMessage = t('errors.pixMinAmount', { amount: MIN_PIX_AMOUNT_BRL })
    // PIX Automático (recurring) codes — rejected at the entry guard for scanned/pasted
    // deep links, and mapped from the backend's typed 400 PIX_RECURRING_NOT_SUPPORTED.
    const pixRecurringErrorMessage = t('errors.pixRecurring')

    /*
     * Copy for a refusal seen at SCAN time, where the amount is the merchant's
     * and the user cannot change it. The cap and merchant-volume strings
     * therefore offer a smaller CHARGE (something the cashier can ring again),
     * never a smaller amount the screen has no field for.
     */
    const scanFailureCopy: Record<QrScanFailure, string> = useMemo(
        () => ({
            [QR_INIT_CODE.CAP]: t('errors.monthlyCapReachedFixedAmount'),
            [QR_INIT_CODE.MERCHANT_VOLUME]: t('errors.merchantNotAvailable'),
            [QR_INIT_CODE.MERCHANT_REFUND]: t('errors.merchantNotAvailable'),
            [QR_INIT_CODE.NOT_PROVISIONED]: t('errors.kycRequired'),
            [QR_INIT_CODE.KYC]: t('errors.kycRequired'),
            [QR_INIT_CODE.PIX_MIN_AMOUNT]: pixMinAmountErrorMessage,
            [QR_INIT_CODE.PIX_RECURRING]: pixRecurringErrorMessage,
            [QR_INIT_CODE.MISSING_AMOUNT]: t('errors.genericQrDetails'),
            [QR_INIT_CODE.EXPIRED]: t('errors.merchantChargeExpired'),
            [QR_INIT_CODE.DECODE]: qrType === EQrType.PIX ? t('errors.pixDecode') : t('errors.genericDecode'),
            [QR_INIT_CODE.PROVIDER_UNAVAILABLE]: t('errors.providerIssues', { method: qrMethodName }),
            [QR_INIT_CODE.IN_PROGRESS]: t('errors.providerIssues', { method: qrMethodName }),
            /*
             * Never expected from this screen — it derives a key per (scan,
             * amount) — so reaching this is ours to fix, and Sentry still
             * reports it. But the user's way out is a fresh scan (a new key),
             * not a support ticket, so the copy says that rather than the
             * generic "contact support".
             */
            [QR_INIT_CODE.KEY_MISMATCH]: t('errors.restartScan'),
            offline: t('errors.connectionLost'),
            'auth-missing': t('errors.authError'),
            'provider-issues': t('errors.providerIssues', { method: qrMethodName }),
        }),
        [t, pixMinAmountErrorMessage, pixRecurringErrorMessage, qrType, qrMethodName]
    )

    /*
     * Same refusals seen AFTER the user entered an amount. Only the two
     * amount-shaped ones differ: here a smaller number is something the user can
     * actually type, so the copy says so.
     */
    const amountEntryFailureCopy: Partial<Record<QrScanFailure, string>> = useMemo(
        () => ({
            [QR_INIT_CODE.CAP]: t('errors.monthlyCapReached'),
            [QR_INIT_CODE.MERCHANT_VOLUME]: t('errors.merchantNotAvailableTrySmaller'),
        }),
        [t]
    )

    return { scanFailureCopy, amountEntryFailureCopy, pixRecurringErrorMessage }
}
