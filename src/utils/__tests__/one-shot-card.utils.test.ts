/**
 * Every answer of `POST /rain/cards` maps to one card step state (TASK-23329,
 * item 9b), and each state maps to one row state on the setup drawer.
 */
import type { ApplyForCardResponse } from '@/services/rain'
import {
    applyFailureOf,
    cardChainStateFromFailure,
    cardChainStateFromResponse,
    cardRowState,
    cardStepIsOpen,
    type CardChainState,
} from '@/utils/one-shot-card.utils'

describe('cardChainStateFromResponse', () => {
    const cases: Array<[ApplyForCardResponse, CardChainState]> = [
        [
            { status: 'incomplete', missing: [], questionnaireComplete: false, sumsubAccessToken: 'tok-action' },
            { kind: 'questions', token: 'tok-action' },
        ],
        [
            { status: 'main-kyc-required', missingDocTypes: ['SELFIE'], sumsubAccessToken: 'tok-main' },
            { kind: 'identity-step', token: 'tok-main' },
        ],
        [
            { status: 'terms-required', isUsResident: false, termsVersion: '2026-06-01' },
            { kind: 'agreements', isUsResident: false },
        ],
        [
            { status: 'terms-required', isUsResident: true, termsVersion: '2026-06-01' },
            { kind: 'agreements', isUsResident: true },
        ],
        [
            {
                status: 'country-confirmation-required',
                candidates: ['BR', 'PT'],
                evidence: { addressCountry: 'BR', idDocumentCountry: 'PT' },
            },
            { kind: 'country-confirmation', candidates: ['BR', 'PT'] },
        ],
        [{ status: 'pending-identity', message: 'continues once verified' }, { kind: 'setting-up' }],
        [{ status: 'pending', rainUserId: 'rain-1', message: 'submitted' }, { kind: 'setting-up' }],
        [
            { status: 'geo-blocked', message: 'not here' },
            { kind: 'not-available', message: 'not here', reason: 'geo-blocked' },
        ],
        [
            { status: 'pending-residence-blocked', message: 'pending move' },
            { kind: 'not-available', message: 'pending move', reason: 'pending-residence-blocked' },
        ],
        [
            { status: 'ENABLED', rainUserId: 'rain-1', message: 'already approved' },
            { kind: 'applied', status: 'ENABLED' },
        ],
        [
            { status: 'REJECTED', message: 'denied' },
            { kind: 'applied', status: 'REJECTED' },
        ],
    ]

    it.each(cases)('maps %j', (res, expected) => {
        expect(cardChainStateFromResponse(res)).toEqual(expected)
    })
})

describe('cardChainStateFromFailure', () => {
    it('403 provider-not-in-plan for the document country asks for a local ID', () => {
        expect(
            cardChainStateFromFailure({
                code: 'provider-not-in-plan',
                message: 'needs a local document',
                reason: 'document_country_unsupported',
            })
        ).toEqual({ kind: 'needs-local-id' })
    })

    it('403 provider-not-in-plan for another reason is not available, with the reason kept', () => {
        expect(
            cardChainStateFromFailure({ code: 'provider-not-in-plan', message: 'not asked', reason: 'not_requested' })
        ).toEqual({ kind: 'not-available', message: 'not asked', reason: 'not_requested' })
    })

    it.each(['geo-blocked', 'pending-residence-blocked'])('403 %s is not available', (code) => {
        expect(cardChainStateFromFailure({ code, message: 'm' })).toEqual({
            kind: 'not-available',
            message: 'm',
            reason: code,
        })
    })

    it('409 application-outcome-unknown is a check by a person, never a retry', () => {
        expect(cardChainStateFromFailure({ code: 'application-outcome-unknown', message: 'm' })).toEqual({
            kind: 'checking',
        })
    })

    it('422 occupation-not-accepted names the occupation', () => {
        expect(cardChainStateFromFailure({ code: 'occupation-not-accepted', message: 'm' })).toEqual({
            kind: 'occupation-not-accepted',
        })
    })

    it('anything else is an error with the message', () => {
        expect(cardChainStateFromFailure({ message: 'boom' })).toEqual({ kind: 'error', message: 'boom' })
        expect(cardChainStateFromFailure({ code: 'something-new', message: 'new' })).toEqual({
            kind: 'error',
            message: 'new',
        })
    })
})

describe('cardRowState', () => {
    it.each<[CardChainState, ReturnType<typeof cardRowState>]>([
        [{ kind: 'questions', token: 't' }, 'agreements-needed'],
        [{ kind: 'agreements', isUsResident: false }, 'agreements-needed'],
        [{ kind: 'identity-step', token: 't' }, 'document-needed'],
        [{ kind: 'setting-up' }, 'setting-up'],
        [{ kind: 'needs-local-id' }, 'needs-local-id'],
        [{ kind: 'not-available', message: 'm' }, 'not-available'],
        [{ kind: 'checking' }, 'checking'],
        [{ kind: 'occupation-not-accepted' }, 'occupation-not-accepted'],
        // the rail describes an existing application, the callout an error, the card page the confirmation
        [{ kind: 'applied', status: 'ENABLED' }, undefined],
        [{ kind: 'error', message: 'm' }, undefined],
        [{ kind: 'country-confirmation', candidates: ['BR'] }, undefined],
    ])('%j → %s', (chain, expected) => {
        expect(cardRowState(chain)).toBe(expected)
    })

    it('no card step known leaves the rail state', () => {
        expect(cardRowState(null)).toBeUndefined()
        expect(cardRowState(undefined)).toBeUndefined()
    })
})

describe('cardStepIsOpen', () => {
    it('is open only while the questions or the agreements wait on the user', () => {
        expect(cardStepIsOpen({ kind: 'questions', token: 't' })).toBe(true)
        expect(cardStepIsOpen({ kind: 'agreements', isUsResident: true })).toBe(true)
        expect(cardStepIsOpen({ kind: 'setting-up' })).toBe(false)
        expect(cardStepIsOpen({ kind: 'checking' })).toBe(false)
        expect(cardStepIsOpen(null)).toBe(false)
    })
})

describe('applyFailureOf', () => {
    it('reads the code and message off the error and the reason off its body', () => {
        const error = Object.assign(new Error('refused'), {
            code: 'provider-not-in-plan',
            cause: { status: 'error', code: 'provider-not-in-plan', reason: 'document_country_unsupported' },
        })
        expect(applyFailureOf(error)).toEqual({
            code: 'provider-not-in-plan',
            message: 'refused',
            reason: 'document_country_unsupported',
        })
    })

    it('tolerates a plain error, a numeric code and nothing at all', () => {
        expect(applyFailureOf(new Error('down'))).toEqual({ code: undefined, message: 'down', reason: undefined })
        expect(applyFailureOf({ code: 4001, message: 'rejected' })).toEqual({
            code: undefined,
            message: 'rejected',
            reason: undefined,
        })
        expect(applyFailureOf(undefined)).toEqual({ code: undefined, message: '', reason: undefined })
    })
})
