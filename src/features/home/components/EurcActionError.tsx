'use client'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { wireErrorCode } from '@/services/api-error'

export function EurcActionError({ error }: { error: unknown }) {
    const t = useAppTranslations('currencyAccounts')
    if (!error) return null
    const code = wireErrorCode(error)
    const message =
        code === 'insufficient_balance'
            ? t('insufficientBalance')
            : code === 'amount_above_limit'
              ? t('amountLimit')
              : code === 'verification_required' || code === 'banking_unavailable'
                ? t('verificationRequired')
                : code === 'operation_needs_review'
                  ? t('needsReview')
                  : code === 'operation_expired'
                    ? t('expired')
                    : code === 'invalid_bank_account'
                      ? t('badBank')
                      : t('actionError')
    return <p role="alert">{message}</p>
}
