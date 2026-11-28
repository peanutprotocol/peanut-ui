/** @jest-environment node */
import fc from 'fast-check'
import type { CardTopLevelState } from '@/components/Card/cardState.utils'
import { resolveCardViewState, type CardViewInput } from '../cardViewState'

const CARD_STATES: readonly CardTopLevelState[] = [
    'loading',
    'add-card',
    'creating-card',
    'pending',
    'manual-review',
    'requires-info',
    'requires-support',
    'geo-blocked',
    'rejected',
    'active',
]

function baseInput(overrides: Partial<CardViewInput> = {}): CardViewInput {
    return {
        hasLoadError: false,
        state: 'add-card',
        issuanceStillCreating: false,
        supportRequiredReason: null,
        isIdentityRejected: false,
        hasResidenceAddressStep: false,
        hasApplication: false,
        hasActivationOverlay: false,
        isIssuing: false,
        pendingApplication: null,
        geoBlocked: false,
        pendingResidenceBlocked: false,
        terminalKycError: null,
        hasPendingQuestions: false,
        planRefusal: null,
        hasPendingCountryConfirmation: false,
        fundingRequired: false,
        hasPendingTerms: false,
        hasTermsFundingPath: false,
        fundingAccessLoading: false,
        capabilitiesLoading: false,
        showIssuedCelebration: false,
        hasActiveCard: false,
        ...overrides,
    }
}

const cardViewInputArb: fc.Arbitrary<CardViewInput> = fc.record({
    hasLoadError: fc.boolean(),
    state: fc.constantFrom(...CARD_STATES),
    issuanceStillCreating: fc.boolean(),
    supportRequiredReason: fc.option(fc.constantFrom('name_mismatch', 'manual_review'), { nil: null }),
    isIdentityRejected: fc.boolean(),
    hasResidenceAddressStep: fc.boolean(),
    hasApplication: fc.boolean(),
    hasActivationOverlay: fc.boolean(),
    isIssuing: fc.boolean(),
    pendingApplication: fc.option(fc.constantFrom<'pending-identity' | 'pending'>('pending-identity', 'pending'), {
        nil: null,
    }),
    geoBlocked: fc.boolean(),
    pendingResidenceBlocked: fc.boolean(),
    terminalKycError: fc.option(fc.constant('Support needed'), { nil: null }),
    hasPendingQuestions: fc.boolean(),
    planRefusal: fc.option(
        fc.constantFrom('identity_document_insufficient', 'document_country_unsupported', 'requirements_uncollectable'),
        { nil: null }
    ),
    hasPendingCountryConfirmation: fc.boolean(),
    fundingRequired: fc.boolean(),
    hasPendingTerms: fc.boolean(),
    hasTermsFundingPath: fc.boolean(),
    fundingAccessLoading: fc.boolean(),
    capabilitiesLoading: fc.boolean(),
    showIssuedCelebration: fc.boolean(),
    hasActiveCard: fc.boolean(),
})

describe('resolveCardViewState (exhaustive priority & safety invariants)', () => {
    it('is total across arbitrary combinations and never hides a load error behind a spinner', () => {
        fc.assert(
            fc.property(cardViewInputArb, (input) => {
                const view = resolveCardViewState(input)
                expect(typeof view.kind).toBe('string')
                if (input.hasLoadError) {
                    expect(view.kind).toBe('load-error')
                }
                if (!input.hasLoadError && input.state === 'loading') {
                    expect(view.kind).toBe('loading')
                }
            }),
            { numRuns: 500, seed: 42 }
        )
    })

    it('never preempts an active card with support-required, identity-rejected, or residence-address onboarding gates', () => {
        const view = resolveCardViewState(
            baseInput({
                state: 'active',
                hasActiveCard: true,
                supportRequiredReason: 'stale_reason',
                isIdentityRejected: true,
                hasResidenceAddressStep: true,
            })
        )
        expect(view).toEqual({ kind: 'active' })
    })

    it('falls back to requires-support when state is active but no active card exists (and celebration is off)', () => {
        expect(resolveCardViewState(baseInput({ state: 'active', hasActiveCard: false }))).toEqual({
            kind: 'requires-support',
        })
        expect(
            resolveCardViewState(baseInput({ state: 'active', hasActiveCard: false, showIssuedCelebration: true }))
        ).toEqual({ kind: 'issued-celebration' })
    })

    it('keeps computed geo-blocked ahead of cached residence-address step', () => {
        expect(resolveCardViewState(baseInput({ state: 'geo-blocked', hasResidenceAddressStep: true }))).toEqual({
            kind: 'geo-blocked',
        })
    })

    it('classifies reuploadable vs support-only plan refusals explicitly', () => {
        expect(resolveCardViewState(baseInput({ planRefusal: 'identity_document_insufficient' }))).toEqual({
            kind: 'plan-refusal',
            reasonCode: 'identity_document_insufficient',
            canReupload: true,
        })
        expect(resolveCardViewState(baseInput({ planRefusal: 'requirements_uncollectable' }))).toEqual({
            kind: 'plan-refusal',
            reasonCode: 'requirements_uncollectable',
            canReupload: false,
        })
    })

    it('waits on funding-access load before rendering terms, and offers retry on failure', () => {
        expect(
            resolveCardViewState(
                baseInput({ hasPendingTerms: true, hasTermsFundingPath: false, fundingAccessLoading: true })
            )
        ).toEqual({ kind: 'terms-loading' })
        expect(
            resolveCardViewState(
                baseInput({ hasPendingTerms: true, hasTermsFundingPath: false, fundingAccessLoading: false })
            )
        ).toEqual({ kind: 'terms-load-error' })
        expect(resolveCardViewState(baseInput({ hasPendingTerms: true, hasTermsFundingPath: true }))).toEqual({
            kind: 'terms',
        })
    })

    it('falls back to requires-support on an unknown future backend card state', () => {
        expect(resolveCardViewState(baseInput({ state: 'future_unknown' as CardTopLevelState }))).toEqual({
            kind: 'requires-support',
        })
    })
})
