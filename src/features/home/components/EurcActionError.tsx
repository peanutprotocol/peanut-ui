'use client'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { wireErrorCode } from '@/services/api-error'
import { Callout } from '@/components/0_Bruddle/Callout'

export function EurcActionError({ error, minimumCurrency }: { error: unknown; minimumCurrency: string }) {
    const t = useAppTranslations('currencyAccounts')
    if (!error) return null
    // Literal t() calls keep every message visible to scripts/screen-wordiness.mjs.
    const message = (() => {
        switch (wireErrorCode(error)) {
            case 'insufficient_balance':
                return t('insufficientBalance')
            case 'amount_above_limit':
                return t('amountLimit')
            case 'verification_required':
                return t('verificationRequired')
            case 'banking_unavailable':
                return t('bankingUnavailable')
            case 'operation_needs_review':
                return t('needsReviewError')
            case 'operation_expired':
                return t('expired')
            case 'invalid_bank_account':
                return t('badBank')
            case 'operation_in_flight':
                return t('inFlight')
            case 'amount_below_minimum':
                return t('belowMinimum', { currency: minimumCurrency })
            case 'unsupported_precision':
                return t('tooPrecise')
            default:
                return t('actionError')
        }
    })()
    return <Callout priority="error">{message}</Callout>
}
