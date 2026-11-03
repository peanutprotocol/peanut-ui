/** Fix E: new-flow rejected and action-required users stay in their verification flow. */
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { PAPERWORK_VERIFICATION_FLOW, type KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { paperworkVerificationEntryRoute, paperworkVerificationRoute } from '../paperworkVerificationEntry'

jest.mock('@/app/actions/kyc-workflow', () => ({ getKycDocumentStatus: jest.fn(), findKycDocumentPlan: jest.fn() }))

const newFlowPlan = {
    available: true,
    activeAttemptId: null,
    policyVersion: 'v1',
    flow: PAPERWORK_VERIFICATION_FLOW,
    proofOfAddress: null,
    features: { qr: true, bank: false, local: false, card: false },
    routes: [],
} as KycDocumentPlan

beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(findKycDocumentPlan).mockResolvedValue(newFlowPlan)
})

it.each(['REJECTED', 'ACTION_REQUIRED'] as const)(
    'a one-shot %s identity is handled in /verify without legacy entry',
    async (status) => {
        jest.mocked(getKycDocumentStatus).mockResolvedValue(status)
        await expect(paperworkVerificationRoute(newFlowPlan, 'bank')).resolves.toBe('/verify')
        await expect(paperworkVerificationRoute(newFlowPlan, 'local')).resolves.toBe('/verify')
        await expect(paperworkVerificationRoute(newFlowPlan, null)).resolves.toBe('/verify')
        await expect(paperworkVerificationEntryRoute({ corridor: 'SEPA_EU' })).resolves.toBe('/verify')
    }
)
