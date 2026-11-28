import type { CardTopLevelState } from '@/components/Card/cardState.utils'

export type CardPendingApplication = 'pending-identity' | 'pending'

export type CardViewState =
    | { kind: 'load-error' }
    | { kind: 'loading' }
    | { kind: 'issuance-still-creating' }
    | { kind: 'support-required'; reasonCode: string }
    | { kind: 'identity-rejected' }
    | { kind: 'residence-address' }
    | { kind: 'feature-activation' }
    | { kind: 'issuing' }
    | { kind: 'pending-application'; variant: CardPendingApplication }
    | { kind: 'geo-blocked-overlay' }
    | { kind: 'pending-residence-blocked' }
    | { kind: 'terminal-kyc-error'; message: string }
    | { kind: 'pending-questions' }
    | { kind: 'plan-refusal'; reasonCode: string; canReupload: boolean }
    | { kind: 'country-confirmation' }
    | { kind: 'funding-required' }
    | { kind: 'terms-loading' }
    | { kind: 'terms-load-error' }
    | { kind: 'terms' }
    | { kind: 'creating-card' }
    | { kind: 'add-card' }
    | { kind: 'pending' }
    | { kind: 'manual-review' }
    | { kind: 'requires-info-loading' }
    | { kind: 'requires-info' }
    | { kind: 'requires-support' }
    | { kind: 'geo-blocked' }
    | { kind: 'rejected' }
    | { kind: 'issued-celebration' }
    | { kind: 'active' }

export interface CardViewInput {
    hasLoadError: boolean
    state: CardTopLevelState
    issuanceStillCreating: boolean
    supportRequiredReason: string | null
    isIdentityRejected: boolean
    hasResidenceAddressStep: boolean
    hasApplication: boolean
    hasActivationOverlay: boolean
    isIssuing: boolean
    pendingApplication: CardPendingApplication | null
    geoBlocked: boolean
    pendingResidenceBlocked: boolean
    terminalKycError: string | null
    hasPendingQuestions: boolean
    planRefusal: string | null
    hasPendingCountryConfirmation: boolean
    fundingRequired: boolean
    hasPendingTerms: boolean
    hasTermsFundingPath: boolean
    fundingAccessLoading: boolean
    capabilitiesLoading: boolean
    showIssuedCelebration: boolean
    hasActiveCard: boolean
}

const REUPLOADABLE_PLAN_REFUSALS: ReadonlySet<string> = new Set([
    'identity_document_insufficient',
    'document_country_unsupported',
])

/**
 * Pure, total priority reducer for CardPage.
 *
 * Replaces the 16-branch imperative if-ladder so every combination of
 * overview, KYC, terms, and overlay flags maps to one explicit discriminated
 * view — never a blank screen, never a spinner hiding an error, and never
 * preempting an already-active card with onboarding overlays.
 */
export function resolveCardViewState(input: CardViewInput): CardViewState {
    if (input.hasLoadError) return { kind: 'load-error' }
    if (input.state === 'loading') return { kind: 'loading' }
    if (input.issuanceStillCreating) return { kind: 'issuance-still-creating' }
    if (input.supportRequiredReason && input.state !== 'active') {
        return { kind: 'support-required', reasonCode: input.supportRequiredReason }
    }
    if (input.state !== 'active' && input.isIdentityRejected) {
        return { kind: 'identity-rejected' }
    }
    if (
        input.hasResidenceAddressStep &&
        input.state !== 'active' &&
        input.state !== 'geo-blocked' &&
        !input.hasApplication &&
        !input.planRefusal &&
        !input.geoBlocked &&
        !input.pendingResidenceBlocked
    ) {
        return { kind: 'residence-address' }
    }
    if (input.hasActivationOverlay) return { kind: 'feature-activation' }
    if (input.isIssuing) return { kind: 'issuing' }
    if (input.pendingApplication && input.state === 'add-card') {
        return { kind: 'pending-application', variant: input.pendingApplication }
    }
    if (input.geoBlocked) return { kind: 'geo-blocked-overlay' }
    if (input.pendingResidenceBlocked) return { kind: 'pending-residence-blocked' }
    if (input.terminalKycError) {
        return { kind: 'terminal-kyc-error', message: input.terminalKycError }
    }
    if (input.hasPendingQuestions) return { kind: 'pending-questions' }
    if (input.planRefusal) {
        return {
            kind: 'plan-refusal',
            reasonCode: input.planRefusal,
            canReupload: REUPLOADABLE_PLAN_REFUSALS.has(input.planRefusal),
        }
    }
    if (input.hasPendingCountryConfirmation) return { kind: 'country-confirmation' }
    if (input.fundingRequired) return { kind: 'funding-required' }
    if (input.hasPendingTerms) {
        if (!input.hasTermsFundingPath) {
            return input.fundingAccessLoading ? { kind: 'terms-loading' } : { kind: 'terms-load-error' }
        }
        return { kind: 'terms' }
    }

    switch (input.state) {
        case 'creating-card':
            return { kind: 'creating-card' }
        case 'add-card':
            return { kind: 'add-card' }
        case 'pending':
            return { kind: 'pending' }
        case 'manual-review':
            return { kind: 'manual-review' }
        case 'requires-info':
            return input.capabilitiesLoading ? { kind: 'requires-info-loading' } : { kind: 'requires-info' }
        case 'requires-support':
            return { kind: 'requires-support' }
        case 'geo-blocked':
            return { kind: 'geo-blocked' }
        case 'rejected':
            return { kind: 'rejected' }
        case 'active':
            if (input.showIssuedCelebration) return { kind: 'issued-celebration' }
            return input.hasActiveCard ? { kind: 'active' } : { kind: 'requires-support' }
        default:
            return { kind: 'requires-support' }
    }
}
