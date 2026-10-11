'use client'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { wireErrorCode } from '@/services/api-error'
import { Callout } from '@/components/0_Bruddle/Callout'

export function EurcActionError({ error, minimumCurrency }: { error: unknown; minimumCurrency: string }) {
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
                      : code === 'operation_in_flight'
                        ? t('inFlight')
                        : code === 'amount_below_minimum'
                          ? t('belowMinimum', { currency: minimumCurrency })
                          : code === 'unsupported_precision'
                            ? t('tooPrecise')
                            : t('actionError')
    return <Callout priority="error">{message}</Callout>
}
