'use client'
import { Callout } from '@/components/0_Bruddle/Callout'
import { wireErrorCode } from '@/services/api-error'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

const codes = {
    verification_required: 'verificationRequired',
    kyc_sharing_unavailable: 'kycSharingUnavailable',
    monerium_unavailable: 'moneriumUnavailable',
    monerium_refused: 'moneriumRefused',
    invalid_form: 'invalidForm',
    invalid_state: 'invalidState',
    invalid_signature: 'invalidSignature',
    wallet_missing: 'walletMissing',
    wallet_not_deployed: 'walletNotDeployed',
    address_linked_elsewhere: 'addressLinkedElsewhere',
    link_required: 'linkRequired',
    onboarding_incomplete: 'onboardingIncomplete',
    invalid_amount: 'invalidAmount',
    amount_below_minimum: 'amountBelowMinimum',
    supporting_document_required: 'supportingDocumentRequired',
    idempotency_conflict: 'idempotencyConflict',
    invalid_bank_account: 'invalidBankAccount',
    operation_in_flight: 'operationInFlight',
    insufficient_balance: 'insufficientBalance',
    operation_not_found: 'operationNotFound',
    operation_expired: 'operationExpired',
    operation_already_submitted: 'operationAlreadySubmitted',
    residence_prohibited: 'residenceProhibited',
    not_available: 'notAvailable',
    citizenship_prohibited: 'citizenshipProhibited',
    country_not_supported: 'countryNotSupported',
    provider_unavailable: 'providerUnavailable',
    disabled: 'disabled',
    not_allowlisted: 'notAllowlisted',
    residence_unknown: 'residenceUnknown',
    eurc_enrolled: 'eurcEnrolled',
    eurc_unknown: 'eurcUnknown',
} as const

export function MoneriumActionError({ error, withdraw = false }: { error: unknown; withdraw?: boolean }) {
    const t = useAppTranslations('currencyAccounts.monerium')
    const code = wireErrorCode(error)
    const suffix = code && Object.hasOwn(codes, code) ? codes[code as keyof typeof codes] : 'generic'
    return <Callout priority="error">{t(`${withdraw ? 'withdraw.error' : 'error'}.${suffix}`)}</Callout>
}
