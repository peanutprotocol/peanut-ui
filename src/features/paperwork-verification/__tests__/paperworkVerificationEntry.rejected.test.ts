/** Fix E: new-flow action-required users stay in their verification flow; a rejected attempt leaves it. */
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
// The API marks a REJECTED attempt unsupported: the plan has no flow.
const rejectedPlan = { ...newFlowPlan, available: false, flow: null } as KycDocumentPlan

beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(findKycDocumentPlan).mockResolvedValue(newFlowPlan)
})

it('a one-shot ACTION_REQUIRED identity is handled in /verify without legacy entry', async () => {
    jest.mocked(getKycDocumentStatus).mockResolvedValue('ACTION_REQUIRED')
    await expect(paperworkVerificationRoute(newFlowPlan, 'bank')).resolves.toBe('/verify')
    await expect(paperworkVerificationRoute(newFlowPlan, 'local')).resolves.toBe('/verify')
    await expect(paperworkVerificationRoute(newFlowPlan, null)).resolves.toBe('/verify')
    await expect(paperworkVerificationEntryRoute({ corridor: 'SEPA_EU' })).resolves.toBe('/verify')
})

it('a REJECTED attempt the API keeps on the flow is handled in /verify', async () => {
    jest.mocked(getKycDocumentStatus).mockResolvedValue('REJECTED')
    await expect(paperworkVerificationRoute(newFlowPlan, 'bank')).resolves.toBe('/verify')
    await expect(paperworkVerificationEntryRoute({ corridor: 'SEPA_EU' })).resolves.toBe('/verify')
})

it('a REJECTED attempt off the flow keeps the entry’s own start', async () => {
    jest.mocked(findKycDocumentPlan).mockResolvedValue(rejectedPlan)
    jest.mocked(getKycDocumentStatus).mockResolvedValue('REJECTED')
    await expect(paperworkVerificationRoute(rejectedPlan, 'bank')).resolves.toBeNull()
    await expect(paperworkVerificationEntryRoute({ corridor: 'SEPA_EU' })).resolves.toBeNull()
})
