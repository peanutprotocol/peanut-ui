jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
import { setAuthToken } from '@/utils/auth-token'
import posthog from 'posthog-js'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaperworkVerificationQuestions } from '@/app/actions/types/kyc-paperwork-verification.types'
import {
    getKycQuestions,
    saveKycAnswers,
    savePaperworkVerificationFeatures,
    startPaperworkVerificationIdentity,
} from '@/app/actions/kyc-paperwork-verification'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { PaperworkVerificationFlow } from '../PaperworkVerificationFlow'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

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
    }: {
        visible: boolean
        onComplete: () => void
        onClose: () => void
        onRefreshToken: () => Promise<string>
    }) =>
        visible ? (
            <div>
                <button onClick={onComplete}>sumsub-submit</button>
                <button onClick={onClose}>sumsub-close</button>
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
    flow: 'verify-once' as const,
    proofOfAddress: null,
    features: { qr: true, bank: true, local: false, card: true },
    routes: [
        {
            id: 'base',
            documents: [
                {
                    key: 'identity',
                    code: 'IDENTITY' as const,
                    requiredBy: ['SUMSUB' as const],
                    types: ['PASSPORT'] as never[],
                    countries: ['US'],
                },
            ],
        },
    ],
}

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

function renderFlow(search = '') {
    return renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <NuqsTestingAdapter searchParams={search} hasMemory>
                <PaperworkVerificationFlow />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
}

// The steps overview opens at once as a skeleton; Continue works once the server's read fills it.
async function startFlow(search = '') {
    const view = renderFlow(search)
    await screen.findByTestId('verify-steps')
    fireEvent.click(screen.getByTestId('verify-steps-continue'))
    return view
}

const continueButton = () => screen.getByTestId('verify-continue')

const mockStartAction = jest.fn()

beforeEach(() => {
    mockIdentityReason = undefined
    mockIdentity = {}
    jest.clearAllMocks()
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
    mockStatus.mockResolvedValue('NOT_STARTED')
    mockQuestions.mockResolvedValue(build())
})

const session = (attemptId = 'attempt-1') => ({
    kind: 'session' as const,
    session: { attemptId, token: 'sdk-token', applicantId: 'fixture-applicant', levelName: 'base' } as never,
})

describe('canonical identity recovery acceptance', () => {
    afterEach(() => jest.useRealTimers())

    it('reloads a PENDING identity into review and continues polling without local SDK submission', async () => {
        jest.useFakeTimers()
        mockStatus.mockResolvedValue('PENDING')
        renderFlow()
        expect(await screen.findByTestId('verify-review-home')).toBeInTheDocument()
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
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: 'Choose another document' }))
        expect(
            screen.getByText('This document cannot be used for verification. Please choose another document.')
        ).toBeInTheDocument()
        expect(mockPush).toHaveBeenCalledWith('/verify?step=id&restart=1')
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
        expect(mockPush).toHaveBeenCalledWith('/home')
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

describe('identity-session hand-back recovery', () => {
    it('a handed-back identity token routes Home without opening the SDK', async () => {
        mockQuestions.mockResolvedValue(build({ purpose: true, money: true, tax: true }, null))
        mockToken.mockResolvedValue({ kind: 'handed-back' } as never)
        await startFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
        expect(screen.queryByText('sumsub-submit')).not.toBeInTheDocument()
        expect(screen.queryByTestId('verify-id-error')).not.toBeInTheDocument()
        expect(mockToken).toHaveBeenCalledTimes(1)
    })

    it('a handed-back token refresh closes the stale SDK and routes Home', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        mockToken.mockResolvedValueOnce(session()).mockResolvedValueOnce({ kind: 'handed-back' } as never)
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
