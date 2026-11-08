import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaperworkVerificationQuestions } from '@/app/actions/types/kyc-paperwork-verification.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import type { IdentityVerification } from '@/types/capabilities'
import { getKycQuestions } from '@/app/actions/kyc-paperwork-verification'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { KycFlowHandedBackError } from '@/app/actions/kyc-flow-hand-back'
import { PaperworkVerificationFlow } from '../PaperworkVerificationFlow'

// A decided rejection (Sumsub RED + FINAL) ends on /verify with its reason. Today the API takes the
// rejected attempt off the flow (questions unavailable, no plan flow); a later API may keep it on.

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/app/actions/kyc-paperwork-verification', () => ({
    getKycQuestions: jest.fn(),
    saveKycAnswers: jest.fn(),
    savePaperworkVerificationFeatures: jest.fn(),
    startPaperworkVerificationIdentity: jest.fn(),
    skipProofOfAddress: jest.fn(async () => true),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({
    refreshKycIdentityStatus: jest.fn(async () => undefined),
    findKycDocumentPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(),
}))
let mockIdentity: IdentityVerification
const mockLogout = jest.fn(async () => undefined)
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => ({ user: { user: { userId: 'user-a' } } }),
    useAuth: () => ({
        user: { user: { userId: 'user-a', username: 'tester' }, identityVerification: mockIdentity },
        fetchUser: jest.fn(async () => undefined),
        logoutUser: mockLogout,
    }),
}))
const mockSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContextOptional: () => ({ openSupportWithMessage: mockSupport }),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useSumsubKycFlow', () => ({ useSumsubKycFlow: jest.fn(() => ({})) }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))

const plan: KycDocumentPlan = {
    available: true,
    activeAttemptId: 'attempt-1',
    policyVersion: 'v1',
    flow: 'verify-once',
    proofOfAddress: null,
    features: { qr: true, bank: true, local: false, card: true },
    routes: [],
} as KycDocumentPlan

const answered: PaperworkVerificationQuestions = {
    available: true,
    attemptId: 'attempt-1',
    residence: 'US',
    steps: [],
    firstUnanswered: null,
    progress: { done: 3, total: 3 },
}

const rejected = (overrides: Partial<IdentityVerification> = {}): IdentityVerification => ({
    status: 'failed',
    canRetry: false,
    rejectLabels: ['DUPLICATE'],
    oneShot: true,
    ...overrides,
})

/** Today's API for a rejected attempt: off the flow. */
function todaysApi() {
    jest.mocked(getKycQuestions).mockResolvedValue({ ...answered, available: false, attemptId: null })
    jest.mocked(findKycDocumentPlan).mockResolvedValue({ ...plan, available: false, flow: null, activeAttemptId: null })
}

const renderFlow = () =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <NuqsTestingAdapter hasMemory>
                <PaperworkVerificationFlow />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )

const DUPLICATE_COPY =
    'This ID is already linked to another Peanut account. Log in to that account, or message support and we’ll help you sort it out.'

beforeEach(() => {
    jest.clearAllMocks()
    mockIdentity = rejected()
    jest.mocked(getKycDocumentStatus).mockResolvedValue('REJECTED')
    todaysApi()
})

describe('a rejected identity on /verify', () => {
    it('shows the duplicate reason instead of bouncing Home (today’s API)', async () => {
        renderFlow()
        expect(await screen.findByText('We couldn’t verify your ID')).toBeInTheDocument()
        expect(screen.getByText(DUPLICATE_COPY)).toBeInTheDocument()
        expect(screen.queryByText(/Home shows what to do next/)).toBeNull()
        expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('opens support with a prefilled message naming the duplicate', async () => {
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: 'Contact support' }))
        expect(mockSupport).toHaveBeenCalledTimes(1)
        const message = mockSupport.mock.calls[0][0] as string
        expect(message).toContain('my documents are already on another Peanut account')
        expect(message).toContain('reason: duplicate_account')
    })

    it('leads with Contact support and offers the other account second', async () => {
        renderFlow()
        await screen.findByRole('button', { name: 'Contact support' })
        const names = screen.getAllByRole('button').map((b) => b.textContent)
        expect(names.indexOf('Contact support')).toBeLessThan(names.indexOf('Log in to another account'))
    })

    it('offers to log in to the other account', async () => {
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: 'Log in to another account' }))
        expect(mockLogout).toHaveBeenCalledTimes(1)
    })

    it('Go to Home is still offered', async () => {
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: 'Go to Home' }))
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })

    it('reads the API’s duplicate_account reason when the rejected attempt stays on the flow', async () => {
        mockIdentity = rejected({
            rejectLabels: ['DUPLICATE'],
            reason: { code: 'duplicate_account', userMessage: 'Your documents are on another account.' },
        })
        jest.mocked(getKycQuestions).mockResolvedValue(answered)
        jest.mocked(findKycDocumentPlan).mockResolvedValue(plan)
        renderFlow()
        expect(await screen.findByText(DUPLICATE_COPY)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('a decision it cannot name gets the support ending without the label', async () => {
        mockIdentity = rejected({ rejectLabels: ['FORGERY'] })
        renderFlow()
        expect(await screen.findByText('We couldn’t verify your ID')).toBeInTheDocument()
        expect(
            screen.getByText('We couldn’t finish your ID check in the app. Message support and we’ll take a look.')
        ).toBeInTheDocument()
        expect(screen.queryByText(/forg|altered|original/i)).toBeNull()
        expect(screen.queryByRole('button', { name: 'Log in to another account' })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(mockSupport.mock.calls[0][0]).not.toMatch(/FORGERY/)
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('a region rejection explains itself and offers no support punt', async () => {
        mockIdentity = rejected({
            rejectLabels: ['WRONG_USER_REGION'],
            reason: { code: 'identity_region_restricted', userMessage: 'Region' },
        })
        renderFlow()
        expect(
            await screen.findByText(
                "Our verification partner doesn't accept documents issued in your country. Re-uploading won't change the result."
            )
        ).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Contact support' })).toBeNull()
    })

    it('a final rejection on a retry-type label lists no fix it cannot take and offers support', async () => {
        mockIdentity = rejected({ rejectLabels: ['DOCUMENT_BAD_QUALITY'] })
        renderFlow()
        expect(
            await screen.findByText(
                'We couldn’t finish your ID check in the app. Message support and we’ll take a look.'
            )
        ).toBeInTheDocument()
        expect(screen.queryByText('Low quality document')).toBeNull()
        expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
    })

    it('an age decision says so and keeps support for a review', async () => {
        mockIdentity = rejected({ rejectLabels: ['AGE_BELOW_ACCEPTED_LIMIT'] })
        renderFlow()
        expect(await screen.findByText('You must be at least 18 years old to use this service.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
        expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
    })

    it('a status read that fails still shows the rejection the profile holds', async () => {
        jest.mocked(getKycDocumentStatus).mockRejectedValue(new Error('down'))
        renderFlow()
        expect(await screen.findByText(DUPLICATE_COPY)).toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('a hand-back does not send a rejected identity Home either', async () => {
        jest.mocked(getKycQuestions).mockRejectedValue(new KycFlowHandedBackError())
        renderFlow()
        expect(await screen.findByText(DUPLICATE_COPY)).toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('a retryable identity off the flow still goes Home', async () => {
        mockIdentity = { status: 'action_required', oneShot: true }
        jest.mocked(getKycDocumentStatus).mockResolvedValue('ACTION_REQUIRED')
        renderFlow()
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
    })
})
