import { getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { isVerifyOnceEnabled } from '../verifyOnceFlag'
import { entryFeature, verifyOnceRoute } from '../verifyOnceEntry'

jest.mock('@/app/actions/kyc-workflow', () => ({ getKycDocumentStatus: jest.fn() }))
jest.mock('../verifyOnceFlag', () => ({ isVerifyOnceEnabled: jest.fn() }))
const mockStatus = getKycDocumentStatus as jest.MockedFunction<typeof getKycDocumentStatus>
const mockEnabled = isVerifyOnceEnabled as jest.MockedFunction<typeof isVerifyOnceEnabled>

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
    mockEnabled.mockReturnValue(true)
    mockStatus.mockResolvedValue('NOT_STARTED')
})

describe('verifyOnceRoute', () => {
    it('keeps today’s flow when the server does not say verify-once', async () => {
        await expect(verifyOnceRoute(plan({ flow: 'document-first' }), null)).resolves.toBeNull()
        await expect(verifyOnceRoute(null, null)).resolves.toBeNull()
        expect(mockStatus).not.toHaveBeenCalled()
    })

    it('keeps today’s flow with the flag off, whatever an old plan says', async () => {
        mockEnabled.mockReturnValue(false)
        await expect(verifyOnceRoute(plan(), null)).resolves.toBeNull()
    })

    it('sends a user who is not verified yet to the questions', async () => {
        await expect(verifyOnceRoute(plan(), 'bank')).resolves.toBe('/verify')
        mockStatus.mockResolvedValue('IN_REVIEW')
        await expect(verifyOnceRoute(plan(), null)).resolves.toBe('/verify')
    })

    it('leaves a rejection or an action to today’s fixes', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        await expect(verifyOnceRoute(plan(), null)).resolves.toBeNull()
        mockStatus.mockResolvedValue('REJECTED')
        await expect(verifyOnceRoute(plan(), 'bank')).resolves.toBeNull()
    })

    it('sends a verified user to add-later only for a feature not yet saved', async () => {
        mockStatus.mockResolvedValue('APPROVED')
        await expect(verifyOnceRoute(plan(), 'bank')).resolves.toBe('/verify?feature=bank')
        await expect(verifyOnceRoute(plan(), 'card')).resolves.toBeNull()
        await expect(verifyOnceRoute(plan(), null)).resolves.toBeNull()
    })
})

describe('entryFeature', () => {
    it('maps Bridge entry points to the bank feature and leaves Manteca on today’s flow', () => {
        expect(entryFeature({ intent: 'NA' })).toBe('bank')
        expect(entryFeature({ intent: 'EU' })).toBe('bank')
        expect(entryFeature({ corridor: 'ACH_US' })).toBe('bank')
        expect(entryFeature({ intent: 'LATAM' })).toBeNull()
        expect(entryFeature({ intent: 'NA', targetCountry: 'AR' })).toBeNull()
        expect(entryFeature({})).toBeNull()
    })
})
