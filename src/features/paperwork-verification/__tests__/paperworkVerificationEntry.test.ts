import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import {
    entryFeature,
    paperworkVerificationEntryRoute,
    paperworkVerificationRoute,
} from '../paperworkVerificationEntry'

jest.mock('@/app/actions/kyc-workflow', () => ({ getKycDocumentStatus: jest.fn(), findKycDocumentPlan: jest.fn() }))
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
    jest.clearAllMocks()
    mockStatus.mockResolvedValue('NOT_STARTED')
})

// Every entry point reads this before its start modal: a verify-once user never sees that modal.
describe('paperworkVerificationEntryRoute', () => {
    it('names /verify, or the entry\u2019s add-later screen, from the entry itself', async () => {
        jest.mocked(findKycDocumentPlan).mockResolvedValue(plan())
        await expect(paperworkVerificationEntryRoute({ corridor: 'SEPA_EU' })).resolves.toBe('/verify')

        mockStatus.mockResolvedValue('APPROVED')
        await expect(paperworkVerificationEntryRoute({ corridor: 'SEPA_EU' })).resolves.toBe('/verify?feature=bank')
        await expect(paperworkVerificationEntryRoute({ intent: 'LATAM', targetCountry: 'AR' })).resolves.toBe(
            '/verify?feature=local'
        )

        // today's flow, or a plan that cannot be read: the start modal stays
        jest.mocked(findKycDocumentPlan).mockResolvedValue(plan({ flow: 'document-first' }))
        await expect(paperworkVerificationEntryRoute({ corridor: 'SEPA_EU' })).resolves.toBeNull()
        jest.mocked(findKycDocumentPlan).mockRejectedValue(new Error('KYC plan unavailable'))
        await expect(paperworkVerificationEntryRoute({ corridor: 'SEPA_EU' })).resolves.toBeNull()
    })
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
