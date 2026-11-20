jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
import { serverFetch } from '@/utils/api-fetch'
import { setAuthToken } from '@/utils/auth-token'
import posthog from 'posthog-js'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaperworkVerificationQuestions } from '@/app/actions/types/kyc-paperwork-verification.types'
import type { KycDocumentPlan, KycProfile } from '@/app/actions/types/kyc-workflow.types'
import {
    getIdentityDocumentMismatch,
    getKycQuestions,
    saveKycAnswers,
    savePaperworkVerificationFeatures,
    startPaperworkVerificationIdentity,
} from '@/app/actions/kyc-paperwork-verification'
import { findKycDocumentPlan, findKycReplacementPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { PaperworkVerificationFlow } from '../PaperworkVerificationFlow'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn(), apiFetch: jest.fn(async () => ({ ok: false })) }))

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockExit = jest.fn()
jest.mock('@/utils/confetti', () => ({ confettiPresets: { success: jest.fn() } }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@/features/paperwork-verification/components/IdCardScanAnimation', () => ({
    IdCardScanAnimation: () => null,
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/app/actions/kyc-paperwork-verification', () => ({
    getIdentityDocumentMismatch: jest.fn(async () => null),
    getKycQuestions: jest.fn(),
    saveKycAnswers: jest.fn(),
    savePaperworkVerificationFeatures: jest.fn(),
    startPaperworkVerificationIdentity: jest.fn(),
    skipProofOfAddress: jest.fn(async () => true),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({
    ...jest.requireActual('@/app/actions/kyc-workflow'),
    refreshKycIdentityStatus: jest.fn(async () => undefined),
    findKycDocumentPlan: jest.fn(),
    findKycReplacementPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(),
}))
let mockIdentityReason: string | undefined
let mockIdentity: Record<string, unknown> = {}
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => ({ user: { user: { userId: 'user-a' } } }),
    useAuth: () => ({
        user: {
            user: { userId: 'user-a', username: 'tester' },
            identityVerification: { reason: { code: mockIdentityReason }, ...mockIdentity },
        },
        fetchUser: jest.fn(),
    }),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => mockExit }))
jest.mock('@/hooks/useSumsubKycFlow', () => ({ useSumsubKycFlow: jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: ({
        visible,
        onComplete,
        onClose,
        onRefreshToken,
        onIdentityStepCompleted,
    }: {
        visible: boolean
        onComplete: () => void
        onClose: () => void
        onRefreshToken: () => Promise<string>
        onIdentityStepCompleted: () => void
    }) =>
        visible ? (
            <div>
                <button onClick={onComplete}>sumsub-submit</button>
                <button onClick={onClose}>sumsub-close</button>
                <button onClick={onIdentityStepCompleted}>sumsub-document</button>
                <button onClick={() => void onRefreshToken().catch(() => undefined)}>sumsub-refresh</button>
            </div>
        ) : null,
}))

const mockQuestions = getKycQuestions as jest.MockedFunction<typeof getKycQuestions>
const mockSave = saveKycAnswers as jest.MockedFunction<typeof saveKycAnswers>
const mockToken = startPaperworkVerificationIdentity as jest.MockedFunction<typeof startPaperworkVerificationIdentity>
const mockPlan = findKycDocumentPlan as jest.MockedFunction<typeof findKycDocumentPlan>
const mockStatus = getKycDocumentStatus as jest.MockedFunction<typeof getKycDocumentStatus>

const plan = {
    available: true,
    activeAttemptId: null,
    policyVersion: 'v1',
    flow: 'verify-once',
    proofOfAddress: null,
    features: { qr: true, bank: true, local: false, card: true },
    routes: [
        {
            id: 'base',
            documents: [
                {
                    key: 'identity',
                    code: 'IDENTITY',
                    requiredBy: ['SUMSUB'],
                    types: ['PASSPORT'],
                    countries: ['US'],
                },
            ],
        },
    ],
} satisfies KycDocumentPlan

const candidateProfile = (
    id: string,
    status: KycProfile['attempts'][number]['status'],
    retryRequestedAt: string | null = null
): KycProfile => ({
    identity: {
        canonicalStatus: 'APPROVED',
        status: 'verified',
        applicantId: 'accepted-applicant',
        verificationId: 'identity',
    },
    attempts: [
        {
            id,
            kind: 'IDENTITY',
            status,
            context: {},
            createdAt: '2026-11-19T09:00:00Z',
            decisionSource: null,
            policyVersion: 'v1',
            provider: 'SUMSUB',
            reasonCode: null,
            requirements: [],
            retryRequestedAt,
            reviewedAt: null,
            revision: 1,
            sourceAttemptId: null,
            startedAt: '2026-11-19T09:00:00Z',
            submittedAt: null,
            updatedAt: '2026-11-19T10:00:00Z',
            verificationId: 'identity',
        },
    ],
    geo: null,
    providerAccounts: [],
    residence: { declared: null, secondaryDeclaredCountry: null, verified: null },
    user: { email: null, firstName: null, fullName: null, lastName: null },
})

const build = (
    answered: Record<string, boolean> = {},
    firstUnanswered: string | null = 'money'
): PaperworkVerificationQuestions => ({
    available: true,
    attemptId: 'attempt-1',
    residence: 'US',
    steps: [
        {
            id: 'purpose',
            features: ['card'],
            answered: answered.purpose ?? true,
            fields: [
                {
                    key: 'cardPurpose',
                    kind: 'choice',
                    required: true,
                    options: ['travel', 'bills'],
                    value: 'travel',
                },
            ],
        },
        {
            id: 'money',
            features: ['card'],
            answered: answered.money ?? false,
            fields: [
                {
                    key: 'annualSalary',
                    kind: 'choice',
                    required: true,
                    options: ['under_25k', '25k_50k'],
                    value: '25k_50k',
                },
            ],
        },
        {
            id: 'tax',
            features: ['base'],
            answered: answered.tax ?? false,
            fields: [{ key: 'taxId', kind: 'taxId', required: true, format: 'ssn', value: null }],
        },
    ],
    firstUnanswered: firstUnanswered as PaperworkVerificationQuestions['firstUnanswered'],
    progress: { done: 2, total: 5 },
})

function renderFlow(search = '', props: Parameters<typeof PaperworkVerificationFlow>[0] = {}) {
    return renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <NuqsTestingAdapter searchParams={search} hasMemory>
                <PaperworkVerificationFlow {...props} />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
}

// The steps overview opens at once as a skeleton; Continue works once the server's read fills it.
async function startFlow(search = '') {
    const view = renderFlow(search)
    await screen.findByTestId('setup-redesign-verify-steps')
    fireEvent.click(screen.getByTestId('verify-steps-continue'))
    return view
}

const continueButton = () => screen.getByTestId('verify-continue')

const mockStartAction = jest.fn()

beforeEach(() => {
    mockIdentityReason = undefined
    mockIdentity = {}
    jest.clearAllMocks()
    mockToken.mockReset()
    setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-a' }))}.y`)
    ;(useSumsubKycFlow as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        showWrapper: false,
        accessToken: null,
        handleStartAction: mockStartAction,
        handleClose: jest.fn(),
        handleSdkComplete: jest.fn(),
        refreshToken: jest.fn(),
    })
    mockPlan.mockResolvedValue(plan)
    jest.mocked(findKycReplacementPlan).mockResolvedValue(plan)
    mockStatus.mockResolvedValue('NOT_STARTED')
    mockQuestions.mockResolvedValue(build())
})

const session = (attemptId = 'attempt-1') => ({
    kind: 'session' as const,
    session: { attemptId, token: 'sdk-token', applicantId: 'fixture-applicant', levelName: 'base' } as never,
})

describe('feature re-verification candidate', () => {
    const candidate = {
        kind: 'reverify_for_feature',
        feature: 'card',
        targetProvider: 'RAIN',
        attemptId: 'candidate-1',
    } as const
    const returnTo = '/card?tab=details#status'

    beforeEach(() => {
        mockIdentity = { status: 'verified', oneShot: false }
        mockPlan.mockResolvedValue({ ...plan, entry: candidate })
        mockStatus.mockImplementation(async (_signal, attemptId) => (attemptId ? 'NOT_STARTED' : 'APPROVED'))
        mockQuestions.mockResolvedValue({ ...build(), attemptId: candidate.attemptId })
    })
    afterEach(() => jest.useRealTimers())

    it('opens and saves candidate questions despite accepted identity approval', async () => {
        mockSave.mockResolvedValue({ kind: 'saved', next: null })
        renderFlow('', { candidate, returnTo })
        expect(await screen.findByTestId('verify-pick-annualSalary')).toBeInTheDocument()
        expect(mockQuestions).toHaveBeenCalledWith('card', candidate.attemptId, expect.any(Function))
        fireEvent.click(continueButton())
        await waitFor(() => expect(mockSave.mock.calls[0]?.[4]).toBe(candidate.attemptId))
        expect(mockStatus.mock.calls.every(([, id]) => id === candidate.attemptId)).toBe(true)
        expect(screen.queryByTestId('verify-verified-payments')).not.toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ kyc_flow: 'verify-once', verification_purpose: 'feature_reverification' })
        )
    })

    it('resumes pending, reuploads on RETRY, and returns only when the candidate passes', async () => {
        jest.useFakeTimers()
        mockQuestions.mockResolvedValue({
            ...build({ purpose: true, money: true, tax: true }, null),
            attemptId: candidate.attemptId,
        })
        mockStatus.mockResolvedValue('IN_REVIEW')
        mockToken.mockResolvedValue(session(candidate.attemptId))
        const view = renderFlow('', { candidate, returnTo })
        expect(await screen.findByTestId('verify-review-home')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-verified-payments')).not.toBeInTheDocument()
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000)
        })
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        fireEvent.click(await screen.findByText('sumsub-document'))
        expect(getIdentityDocumentMismatch).toHaveBeenCalledWith(candidate.attemptId)
        fireEvent.click(await screen.findByText('sumsub-submit'))
        expect(mockToken).toHaveBeenCalledWith(candidate.attemptId, undefined, expect.any(Function))
        expect(screen.queryByTestId('verify-verified-payments')).not.toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
        view.unmount()
        mockStatus.mockResolvedValue('NOT_STARTED')
        renderFlow('', { candidate, returnTo })
        expect(await screen.findByTestId('verify-review-home')).toBeInTheDocument()
        expect(mockToken).toHaveBeenCalledTimes(1)
        mockStatus.mockResolvedValue('APPROVED')
        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000)
        })
        fireEvent.click(await screen.findByTestId('verify-verified-payments'))
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(returnTo))
        expect(mockReplace.mock.calls.filter(([url]) => url === returnTo)).toHaveLength(1)
    })

    it('opens the SDK with the document picked from the frozen candidate routes on the wire', async () => {
        const workflow = jest.requireActual<typeof import('@/app/actions/kyc-workflow')>('@/app/actions/kyc-workflow')
        const paperwork = jest.requireActual<typeof import('@/app/actions/kyc-paperwork-verification')>(
            '@/app/actions/kyc-paperwork-verification'
        )
        mockPlan.mockImplementation(workflow.findKycDocumentPlan)
        mockStatus.mockImplementation(workflow.getKycDocumentStatus)
        mockQuestions.mockImplementation(paperwork.getKycQuestions)
        mockToken.mockImplementationOnce(paperwork.startPaperworkVerificationIdentity)
        jest.mocked(serverFetch).mockImplementation(async (path) => {
            const url = new URL(path, 'https://peanut.test')
            let body: unknown
            if (url.pathname === '/users/kyc/plan') {
                const scoped = url.searchParams.get('attemptId') === candidate.attemptId
                body = {
                    available: scoped,
                    activeAttemptId: null,
                    policyVersion: 'v1',
                    flow: 'verify-once',
                    features: { qr: false, bank: false, local: false, card: true },
                    routes: scoped
                        ? [
                              {
                                  id: 'frozen-route',
                                  documents: [
                                      {
                                          key: 'identity',
                                          code: 'IDENTITY',
                                          requiredBy: ['SUMSUB'],
                                          types: ['PASSPORT'],
                                          countries: ['US'],
                                      },
                                  ],
                              },
                          ]
                        : [],
                    entry: { ...candidate, prepared: true },
                } satisfies KycDocumentPlan
            } else if (path === '/users/kyc/profile') {
                body = candidateProfile(candidate.attemptId, 'READY')
            } else if (path === '/users/kyc/questions?feature=card&attemptId=candidate-1') {
                body = { ...build({ purpose: true, money: true, tax: true }, null), attemptId: candidate.attemptId }
            } else if (path === '/users/kyc/attempts/candidate-1/token') {
                body = {
                    attemptId: candidate.attemptId,
                    token: 'candidate-sdk-token',
                    applicantId: 'fixture-applicant',
                    levelName: 'verify-once',
                    sdkConfig: {
                        autoSelectDocumentDefinitions: true,
                        documentDefinitions: { IDENTITY: { country: 'USA', idDocType: 'PASSPORT' } },
                    },
                }
            } else throw new Error('Unexpected request: ' + path)
            return { ok: true, status: 200, json: async () => body } as Response
        })

        renderFlow('', { candidate, returnTo })
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        expect(await screen.findByText('sumsub-submit')).toBeInTheDocument()
        expect(serverFetch).toHaveBeenCalledWith(
            '/users/kyc/attempts/candidate-1/token',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ document: { type: 'PASSPORT', issuingCountry: 'US' } }),
            })
        )
    })

    it('shows Try again on a real profile RETRY even if this tab missed IN_REVIEW', async () => {
        const workflow = jest.requireActual<typeof import('@/app/actions/kyc-workflow')>('@/app/actions/kyc-workflow')
        mockStatus.mockImplementation(workflow.getKycDocumentStatus)
        mockQuestions.mockResolvedValue({
            ...build({ purpose: true, money: true, tax: true }, null),
            attemptId: candidate.attemptId,
        })
        const marker = 'kyc:feature-reverification:submitted:' + JSON.stringify(['user-a', candidate.attemptId])
        sessionStorage.setItem(marker, '1')
        jest.mocked(serverFetch).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => candidateProfile(candidate.attemptId, 'COLLECTING', '2026-11-19T10:00:00Z'),
        } as Response)

        try {
            renderFlow('', { candidate, returnTo })
            expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
            await waitFor(() => expect(sessionStorage.getItem(marker)).toBeNull())
            expect(mockToken).not.toHaveBeenCalled()
        } finally {
            sessionStorage.removeItem(marker)
        }
    })

    it('shows target refusal after FINAL even when plan no longer has the active entry', async () => {
        mockStatus.mockResolvedValue('REJECTED')
        mockPlan.mockResolvedValue(plan)
        renderFlow('', { candidate, returnTo })
        expect(await screen.findByText('Card setup failed. Your existing accounts stay available.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
        expect(mockToken).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('canonical identity recovery acceptance', () => {
    afterEach(() => jest.useRealTimers())

    it('reloads a PENDING identity into review and continues polling without local SDK submission', async () => {
        jest.useFakeTimers()
        mockStatus.mockResolvedValue('PENDING')
        renderFlow()
        expect(await screen.findByTestId('verify-review-home')).toBeInTheDocument()
        expect(posthog.capture).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ kyc_flow: 'verify-once', verification_purpose: 'initial' })
        )
        const readsBeforePoll = mockStatus.mock.calls.length
        await act(async () => {
            jest.advanceTimersByTime(30_000)
        })
        expect(mockStatus.mock.calls.length).toBeGreaterThan(readsBeforePoll)
        expect(mockToken).not.toHaveBeenCalled()
    })

    it.each(['APPROVED', 'ACTION_REQUIRED', 'REJECTED'] as const)(
        'a replacement handoff observes %s even before the submission webhook arrives',
        async (next) => {
            jest.useFakeTimers()
            mockStatus.mockResolvedValue('NOT_STARTED')
            mockQuestions.mockResolvedValue(build({ purpose: true, money: true, tax: true }, null))
            renderFlow('?step=review')
            expect(await screen.findByTestId('verify-review-home')).toBeInTheDocument()
            mockStatus.mockResolvedValue(next)
            await act(async () => {
                await jest.advanceTimersByTimeAsync(15_000)
            })
            if (next === 'APPROVED') expect(await screen.findByTestId('verify-verified-payments')).toBeInTheDocument()
            else {
                const title =
                    next === 'ACTION_REQUIRED' ? 'We need another look at your ID' : 'We couldn’t verify your ID'
                expect(await screen.findByText(title)).toBeInTheDocument()
                expect(screen.queryByRole('button', { name: 'Try again' }) !== null).toBe(next === 'ACTION_REQUIRED')
            }
            expect(mockToken).not.toHaveBeenCalled()
        }
    )

    it('ACTION_REQUIRED offers retry and opens the canonical attempt without another document', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        mockToken.mockResolvedValue(session())
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        await screen.findByText('sumsub-submit')
        expect(mockToken).toHaveBeenCalledTimes(1)
        expect(mockToken.mock.calls[0][0]).toBe('attempt-1')
        expect(mockToken.mock.calls[0][1]).toBeUndefined()
    })

    it('a document-policy hold explains the document replacement and never resubmits the held ID', async () => {
        mockIdentityReason = 'document_policy_hold'
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        await act(async () => {
            renderFlow()
        })
        const choose = await screen.findByRole('button', { name: 'Use a different ID' })
        await waitFor(() => expect(choose).toBeEnabled())
        expect(screen.getByTestId('verify-replacement-document')).toBe(choose)
        fireEvent.click(choose)
        expect(screen.getByText('We can’t verify you with this document.')).toBeInTheDocument()
        expect(mockPush).toHaveBeenCalledWith('/verify?step=id&restart=1')
        expect(mockToken).not.toHaveBeenCalled()
    })

    it('routes a policy hold to support when no replacement document is available', async () => {
        mockIdentityReason = 'document_policy_hold'
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        jest.mocked(findKycReplacementPlan).mockRejectedValueOnce(new Error('plan unavailable'))
        renderFlow()
        expect(await screen.findByRole('link', { name: 'Contact support' })).toHaveAttribute(
            'href',
            'https://peanut.me/support'
        )
        expect(screen.queryByTestId('verify-replacement-document')).not.toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockToken).not.toHaveBeenCalled()
    })

    // FAILED is our check erroring with nothing decided, so it is retried like ACTION_REQUIRED.
    it('FAILED offers retry and opens the canonical attempt without another document', async () => {
        mockStatus.mockResolvedValue('FAILED' as never)
        mockToken.mockResolvedValue(session())
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        await screen.findByText('sumsub-submit')
        expect(mockToken).toHaveBeenCalledTimes(1)
        expect(mockToken.mock.calls[0][0]).toBe('attempt-1')
        expect(mockToken.mock.calls[0][1]).toBeUndefined()
    })

    it('REVERIFYING shows the user as verified, not in review', async () => {
        mockStatus.mockResolvedValue('REVERIFYING')
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        renderFlow()
        expect(await screen.findByTestId('verify-verified-payments')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-review-home')).not.toBeInTheDocument()
    })

    // The API takes a rejected attempt off the flow: questions unavailable, no plan flow.
    it('REJECTED offers Home and cannot retry identity', async () => {
        mockIdentity = { status: 'failed', canRetry: false, rejectLabels: ['DUPLICATE'], oneShot: true }
        mockStatus.mockResolvedValue('REJECTED')
        mockPlan.mockResolvedValue({ ...plan, available: false, flow: null })
        mockQuestions.mockResolvedValue({ ...build(), available: false, attemptId: null })
        renderFlow()
        const home = await screen.findByRole('button', { name: /home/i })
        expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
        expect(mockReplace).not.toHaveBeenCalled()
        fireEvent.click(home)
        expect(mockReplace).toHaveBeenCalledWith('/home')
        expect(mockToken).not.toHaveBeenCalled()
    })

    it('a document-required retry presents the ID picker', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        mockToken.mockResolvedValue({ kind: 'document-required' } as never)
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        expect(await screen.findByTestId('verify-id')).toBeInTheDocument()
        expect(screen.queryByText('sumsub-submit')).not.toBeInTheDocument()
    })

    it('refreshes and reopens the attempt returned by the last token response', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        mockToken.mockResolvedValueOnce(session('replacement-2')).mockResolvedValue(session('replacement-2'))
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        fireEvent.click(await screen.findByText('sumsub-refresh'))
        await waitFor(() => expect(mockToken).toHaveBeenCalledTimes(2))
        expect(mockToken.mock.calls[1][0]).toBe('replacement-2')
        expect(mockToken.mock.calls[1][1]).toBeUndefined()
        fireEvent.click(screen.getByText('sumsub-close'))
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        await waitFor(() => expect(mockToken).toHaveBeenCalledTimes(3))
        expect(mockToken.mock.calls[2][0]).toBe('replacement-2')
        expect(mockToken.mock.calls[2][1]).toBeUndefined()
    })
})

describe('US person local-transfer opt-out acceptance', () => {
    it('saves all existing selections minus local and reloads questions before continuing', async () => {
        const selected = { qr: true, bank: true, local: true, card: true }
        mockPlan.mockResolvedValue({ ...plan, features: selected })
        mockQuestions.mockResolvedValue({
            ...build(),
            steps: [
                {
                    id: 'declarations',
                    features: ['local'],
                    answered: false,
                    fields: [{ key: 'isFatca', kind: 'toggle', required: true, value: 'yes' }],
                },
            ],
            firstUnanswered: 'declarations',
        })
        mockSave.mockResolvedValue({ kind: 'invalid', errors: { isFatca: 'us_citizen_not_supported' } })
        jest.mocked(savePaperworkVerificationFeatures).mockResolvedValue({ kind: 'saved' })
        await startFlow()
        const fatca = await screen.findByTestId('verify-toggle-isFatca')
        fireEvent.click(fatca)
        fireEvent.click(fatca)
        fireEvent.click(continueButton())
        const optOut = await screen.findByRole('button', { name: /continue without local bank transfers/i })
        const readsBeforeOptOut = mockQuestions.mock.calls.length
        mockQuestions.mockResolvedValue(build())
        fireEvent.click(optOut)
        await waitFor(() =>
            expect(savePaperworkVerificationFeatures).toHaveBeenCalledWith({ ...selected, local: false })
        )
        await waitFor(() => expect(mockQuestions.mock.calls.length).toBeGreaterThan(readsBeforeOptOut))
        expect(await screen.findByTestId('verify-pick-annualSalary')).toBeInTheDocument()
        expect(mockToken).not.toHaveBeenCalled()
        // This recovery path implies a FATCA answer even without a value property.
        // Keep its UI controls but never publish an identified answer-specific event.
        // control_used may say a declaration was toggled or the opt-out tapped (2026-11-03), never with a value.
        const calls = jest.mocked(posthog.capture).mock.calls
        const isUse = (props: unknown, control: string) =>
            (props as { control?: string } | undefined)?.control === control
        const uses = calls.filter(
            ([event, props]) =>
                event === ANALYTICS_EVENTS.CONTROL_USED &&
                (isUse(props, 'isFatca') || isUse(props, 'continue_without_local'))
        )
        const allowed = uses.filter(([, props]) => !Object.prototype.hasOwnProperty.call(props, 'value'))
        expect(allowed).toEqual(uses)
        expect(JSON.stringify(calls.filter((call) => !allowed.includes(call)))).not.toMatch(
            /us_citizen_not_supported|us_person|local_refused|continue_without_local/
        )
        expect(JSON.stringify(calls)).not.toMatch(/"(on|off|yes|no)"/)
        expect(allowed.map(([, props]) => props)).toEqual([
            expect.objectContaining({ screen_id: 'declarations', control: 'isFatca', action: 'toggle' }),
            expect.objectContaining({ screen_id: 'declarations', control: 'isFatca', action: 'toggle' }),
            expect.objectContaining({
                flow: 'paperwork_verification',
                screen_id: 'declarations',
                control: 'continue_without_local',
                action: 'tap',
            }),
        ])
    })
})

describe('form protocol failure copy acceptance', () => {
    it.each(['invalid_body', 'unknown_step', 'rate_limited'])(
        '%s retains answers and explains a form or request issue instead of claiming a network error',
        async (code) => {
            mockSave.mockResolvedValue({ kind: 'blocked', code } as never)
            await startFlow()
            await screen.findByTestId('verify-pick-annualSalary')
            fireEvent.click(continueButton())
            const error = await screen.findByTestId('verify-form-error')
            expect(error.textContent?.trim().length).toBeGreaterThan(0)
            expect(error).not.toHaveTextContent(/check your connection|offline|network/i)
            expect(screen.getByTestId('verify-pick-annualSalary')).toHaveTextContent('$25,000–$49,999')
            expect(mockToken).not.toHaveBeenCalled()
        }
    )
})

describe('identity-session refusal recovery', () => {
    it('a residence refusal on start opens the terminal screen route without an SDK', async () => {
        mockQuestions.mockResolvedValue(build({ purpose: true, money: true, tax: true }, null))
        mockToken.mockResolvedValue({ kind: 'residence-not-supported' })
        await startFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/verify?reason=residence_not_supported'))
        expect(screen.queryByText('sumsub-submit')).not.toBeInTheDocument()
    })

    it('a residence refusal on refresh closes the SDK and opens the terminal screen route', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        mockToken.mockResolvedValueOnce(session()).mockResolvedValueOnce({ kind: 'residence-not-supported' })
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        fireEvent.click(await screen.findByText('sumsub-refresh'))
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/verify?reason=residence_not_supported'))
        await waitFor(() => expect(screen.queryByText('sumsub-submit')).not.toBeInTheDocument())
    })

    it('an existing verification conflict on start routes Home without opening the SDK', async () => {
        mockQuestions.mockResolvedValue(build({ purpose: true, money: true, tax: true }, null))
        mockToken.mockResolvedValue({ kind: 'existing-verification' })
        await startFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
        expect(screen.queryByText('sumsub-submit')).not.toBeInTheDocument()
        expect(screen.queryByTestId('verify-id-error')).not.toBeInTheDocument()
        expect(mockToken).toHaveBeenCalledTimes(1)
    })

    it('an existing verification conflict on refresh closes the stale SDK and routes Home', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        mockToken.mockResolvedValueOnce(session()).mockResolvedValueOnce({ kind: 'existing-verification' })
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        fireEvent.click(await screen.findByText('sumsub-refresh'))
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
        await waitFor(() => expect(screen.queryByText('sumsub-submit')).not.toBeInTheDocument())
        expect(mockToken).toHaveBeenCalledTimes(2)
    })
})

describe('a submitted replacement waits for its own approval', () => {
    afterEach(() => jest.useRealTimers())

    it('a review hand-off opened on REVERIFYING waits and then advances on APPROVED', async () => {
        jest.useFakeTimers()
        mockStatus.mockResolvedValue('REVERIFYING')
        mockQuestions.mockResolvedValue(build({ purpose: true, money: true, tax: true }, null))
        renderFlow('?step=review')
        expect(await screen.findByTestId('verify-review-home')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-verified-payments')).not.toBeInTheDocument()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000)
        })
        expect(screen.getByTestId('verify-review-home')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-verified-payments')).not.toBeInTheDocument()
        const reads = mockStatus.mock.calls.length
        mockStatus.mockResolvedValue('APPROVED')
        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000)
        })
        expect(mockStatus.mock.calls.length).toBeGreaterThan(reads)
        expect(await screen.findByTestId('verify-verified-payments')).toBeInTheDocument()
    })

    it('an SDK submission with stored REVERIFYING stays in review until APPROVED', async () => {
        jest.useFakeTimers()
        mockQuestions.mockResolvedValue(build({ purpose: true, money: true, tax: true }, null))
        mockToken.mockResolvedValue(session())
        await startFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        mockStatus.mockResolvedValue('REVERIFYING')
        fireEvent.click(await screen.findByText('sumsub-submit'))
        expect(await screen.findByTestId('verify-review-home')).toBeInTheDocument()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000)
        })
        expect(screen.getByTestId('verify-review-home')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-verified-payments')).not.toBeInTheDocument()
        mockStatus.mockResolvedValue('APPROVED')
        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000)
        })
        expect(await screen.findByTestId('verify-verified-payments')).toBeInTheDocument()
    })
})
