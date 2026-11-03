import { FIXTURES } from '../registry'
import { SCREENS } from '../../screens/catalogue'

const response = (id: string, key: string): any => FIXTURES[id].responses?.[key]

describe('KYC review screen captures', () => {
    it.each(['choice', 'select'])('registers missing and selected US state %s pickers with every USPS code', (kind) => {
        for (const state of ['missing', 'selected']) {
            const id = `paperwork-verification-state-${kind}-${state}`
            const questions = response(id, 'GET /users/kyc/questions')
            const field = questions.steps[0].fields.find((item: any) => item.key === 'state')
            expect(questions.residence).toBe('US')
            expect(field).toMatchObject({ kind, required: true, value: state === 'missing' ? null : 'CA' })
            expect(new Set(field.options).size).toBe(56)
            expect(field.options).toEqual(expect.arrayContaining(['NY', 'CA', 'DC', 'PR', 'GU', 'VI', 'AS', 'MP']))
            expect(SCREENS.find((screen) => screen.fixture === id)?.route).toBe('/verify?step=address')
        }
    })

    it.each([
        ['residence', 'residence_bank_restricted'],
        ['nationality', 'manteca_us_nationality_restricted'],
        ['tax', 'tax_id_required'],
        ['unknown', 'fixture_unknown_reason'],
    ])('registers an answered saved screen for the %s refusal', (category, reason) => {
        const id = `paperwork-verification-closed-${category}`
        const questions = response(id, 'GET /users/kyc/questions')
        expect(questions.steps.every((step: any) => step.answered)).toBe(true)
        expect(questions.closed.map((item: any) => item.reason)).toEqual([reason])
        expect(SCREENS.find((screen) => screen.fixture === id)?.route).toBe('/verify?step=saved')
    })

    it('keeps policy hold, rejection, outage and foreign-national restart separately registered', () => {
        const held = response('paperwork-verification-policy-hold', 'GET /users/me')
        expect(held.identityVerification).toMatchObject({
            reason: { code: 'document_policy_hold' },
            rejectLabels: ['DOCUMENT_POLICY_HOLD'],
        })
        expect(response('paperwork-verification-policy-hold', 'GET /users/kyc/profile').identity.canonicalStatus).toBe(
            'ACTION_REQUIRED'
        )
        expect(response('paperwork-verification-rejected', 'GET /users/kyc/profile').identity.canonicalStatus).toBe(
            'REJECTED'
        )
        expect(response('paperwork-verification-outage', 'GET /config/kill-switches').kycVerificationDown).toBe(true)
        const id = 'paperwork-verification-restart-foreign'
        expect(response(id, 'GET /users/me').residence.declared).toBe('PT')
        expect(response(id, 'GET /users/kyc/details').nationality).toBe('DE')
        const profile = response(id, 'GET /users/kyc/profile')
        expect(profile.attempts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'IDENTITY', verificationId: profile.identity.verificationId }),
            ])
        )
        for (const suffix of ['policy-hold', 'rejected', 'outage', 'restart-foreign'])
            expect(SCREENS.some((screen) => screen.fixture === `paperwork-verification-${suffix}`)).toBe(true)
    })

    it.each([
        ['bank', 'EUR'],
        ['local', 'ARS'],
    ])(
        'shows %s consent untapped, passes an account already on, and taps for every other answer',
        (feature, currency) => {
            const tap = [{ clickSelector: '[data-testid="kyc-activation-continue"]' }]
            for (const state of [
                'ready',
                'on',
                'setting-up',
                'pending',
                'action-required',
                'refused',
                'failed',
                'questions-missing',
            ]) {
                const id = `feature-activation-${feature}-${state}`
                const report = response(id, 'GET /users/me').capabilities.features[feature]
                const expected = state === 'on' ? 'on' : 'ready'
                expect(report.state).toBe(expected)
                expect(report.accounts[currency].state).toBe(expected)
                expect(SCREENS.find((screen) => screen.fixture === id)?.actions).toEqual(
                    state === 'ready' || state === 'on' ? undefined : tap
                )
            }
        }
    )
})
