import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import { kycActionCtaKey } from '@/utils/kyc-action-copy.utils'
import { isBridgeProcessingSlow } from '@/utils/kyc-processing.utils'
import { KYC_PROCESSING_STALE_AFTER_MS } from '@/constants/kyc.consts'
import { deriveGate } from '@/utils/capability-gate'
import type { RailCapability } from '@/types/capabilities'

describe('KYC action copy', () => {
    it('names the answer a provider waits on', () => {
        expect(
            kycActionCtaKey(
                { key: 'questions:bank', kind: 'questions', purpose: 'questions_missing', feature: 'bank' },
                'questions_missing'
            )
        ).toBe('initiate.ctaAnswerQuestion')
    })

    test.each(['eea_uplift', 'eea_uplift_with_tin', 'source_of_funds', 'tax_identification_number', 'birth_details'])(
        '%s uses questionnaire wording even with an unknown reason',
        (levelKey) => {
            expect(
                kycActionCtaKey({ key: `sumsub:${levelKey}`, kind: 'sumsub', purpose: 'unlock', levelKey }, 'unknown')
            ).toBe('initiate.ctaAnswerQuestions')
        }
    )
    test('a government ID requirement in a group asks for a retake', () => {
        expect(
            kycActionCtaKey({
                key: 'sumsub:identity',
                kind: 'sumsub',
                purpose: 'unlock',
                requirementKeys: ['other', 'government_id_expired'],
            })
        ).toBe('initiate.ctaRetakeId')
    })
    test('proof of source of funds remains a document upload', () => {
        expect(
            kycActionCtaKey({
                key: 'sumsub:proof_of_source_of_funds',
                kind: 'sumsub',
                purpose: 'unlock',
                levelKey: 'proof_of_source_of_funds',
            })
        ).toBe('initiate.ctaUploadDocument')
    })
})

describe('Bridge review age', () => {
    const now = Date.parse('2026-10-23T12:00:00Z')
    beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(now))
    afterEach(() => jest.restoreAllMocks())
    test.each([
        undefined,
        'invalid',
        '',
        new Date(now + 1000).toISOString(),
        new Date(now - KYC_PROCESSING_STALE_AFTER_MS).toISOString(),
    ])('keeps normal waiting copy for %s', (pendingSince) =>
        expect(isBridgeProcessingSlow('bridge_processing', pendingSince)).toBe(false)
    )
    test.each([1, 1000, 3600000, 86400000])('offers support %i ms beyond one day', (extra) => {
        expect(
            isBridgeProcessingSlow(
                'bridge_processing',
                new Date(now - KYC_PROCESSING_STALE_AFTER_MS - extra).toISOString()
            )
        ).toBe(true)
    })
    test('other provider reasons retain their existing wait', () => {
        expect(
            isBridgeProcessingSlow(
                'requirements_in_review',
                new Date(now - 2 * KYC_PROCESSING_STALE_AFTER_MS).toISOString()
            )
        ).toBe(false)
    })
    test('the gate preserves the waiting timestamp', () => {
        const pendingSince = new Date(now - 2 * KYC_PROCESSING_STALE_AFTER_MS).toISOString()
        const rail: RailCapability = {
            id: 'bridge.ach_us',
            provider: 'bridge',
            channel: 'bank',
            method: 'ACH_US',
            country: 'US',
            currency: 'USD',
            status: 'requires-info',
            pendingSince,
            reason: { code: 'bridge_processing', userMessage: 'Reviewing' },
            resolved: { status: 'pending', nextAction: { key: 'wait:bridge', kind: 'wait', purpose: 'review' } },
        }
        const capabilities = withFeatureReport({
            rails: [rail],
            nextActions: [rail.resolved!.nextAction!],
            restrictions: [],
        })
        expect(deriveGate({ ...capabilities, isLoading: false }, 'deposit')).toEqual(
            expect.objectContaining({ kind: 'waiting-on-provider', pendingSince, railId: rail.id })
        )
    })
})
