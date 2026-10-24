import { getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { entryFeature, paperworkVerificationRoute } from '../paperworkVerificationEntry'

jest.mock('@/app/actions/kyc-workflow', () => ({ getKycDocumentStatus: jest.fn() }))
const mockStatus = getKycDocumentStatus as jest.MockedFunction<typeof getKycDocumentStatus>

const plan = (overrides: Partial<KycDocumentPlan> = {}) =>
    ({
        available: true,
        activeAttemptId: null,
        policyVersion: 'v1',
        flow: 'verify-once',
        proofOfAddress: null,
        features: { qr: true, bank: false, local: false, card: true },
        routes: [],
        ...overrides,
    }) as KycDocumentPlan

beforeEach(() => {
    mockStatus.mockResolvedValue('NOT_STARTED')
})

describe('paperworkVerificationRoute', () => {
    it('keeps today’s flow when the server does not put the user on Smart Paperwork Verification', async () => {
        await expect(paperworkVerificationRoute(plan({ flow: 'document-first' }), null)).resolves.toBeNull()
        await expect(paperworkVerificationRoute(null, null)).resolves.toBeNull()
        expect(mockStatus).not.toHaveBeenCalled()
    })

    it('sends a user who is not verified yet to the questions', async () => {
        await expect(paperworkVerificationRoute(plan(), 'bank')).resolves.toBe('/verify')
        mockStatus.mockResolvedValue('IN_REVIEW')
        await expect(paperworkVerificationRoute(plan(), null)).resolves.toBe('/verify')
    })

    it('routes a retry to Smart Paperwork Verification and leaves final rejection to today’s fixes', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        await expect(paperworkVerificationRoute(plan(), null)).resolves.toBe('/verify')
        mockStatus.mockResolvedValue('REJECTED')
        await expect(paperworkVerificationRoute(plan(), 'bank')).resolves.toBeNull()
    })

    it('sends a verified user to add-later only for a feature not yet saved', async () => {
        mockStatus.mockResolvedValue('APPROVED')
        await expect(paperworkVerificationRoute(plan(), 'bank')).resolves.toBe('/verify?feature=bank')
        await expect(paperworkVerificationRoute(plan(), 'card')).resolves.toBeNull()
        await expect(paperworkVerificationRoute(plan(), 'local')).resolves.toBe('/verify?feature=local')
        await expect(
            paperworkVerificationRoute(plan({ features: { qr: true, bank: false, local: true, card: true } }), 'local')
        ).resolves.toBeNull()
        await expect(paperworkVerificationRoute(plan(), null)).resolves.toBeNull()
    })
})

describe('entryFeature', () => {
    it('maps Bridge corridors and EU or NA intent to the bank feature', () => {
        expect(entryFeature({ intent: 'NA' })).toBe('bank')
        expect(entryFeature({ intent: 'EU' })).toBe('bank')
        for (const corridor of ['SEPA_EU', 'FASTER_PAYMENTS_GB', 'ACH_US', 'SPEI_MX', 'BANK_TRANSFER_CO'] as const) {
            expect(entryFeature({ corridor })).toBe('bank')
        }
    })

    it('maps Manteca corridors, LATAM intent, and Argentina or Brazil to the local feature', () => {
        for (const corridor of ['PIX_BR', 'BANK_TRANSFER_AR'] as const) {
            expect(entryFeature({ corridor })).toBe('local')
        }
        expect(entryFeature({ intent: 'LATAM' })).toBe('local')
        expect(entryFeature({ intent: 'NA', targetCountry: 'AR' })).toBe('local')
        expect(entryFeature({ intent: 'EU', targetCountry: 'BR' })).toBe('local')
    })

    it('leaves unsupported destinations unmapped', () => {
        expect(entryFeature({ targetCountry: 'US' })).toBeNull()
        expect(entryFeature({})).toBeNull()
    })
})
