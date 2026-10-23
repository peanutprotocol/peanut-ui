import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import type { VerifyOnceQuestions } from '@/app/actions/types/kyc-verify-once.types'
import {
    getKycQuestions,
    saveKycAnswers,
    saveVerifyOnceFeatures,
    startVerifyOnceIdentity,
} from '@/app/actions/kyc-verify-once'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { VerifyOnceFlow } from '../VerifyOnceFlow'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockExit = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/app/actions/kyc-verify-once', () => ({
    getKycQuestions: jest.fn(),
    saveKycAnswers: jest.fn(),
    saveVerifyOnceFeatures: jest.fn(),
    startVerifyOnceIdentity: jest.fn(),
    skipProofOfAddress: jest.fn(async () => true),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({
    findKycDocumentPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { username: 'tester' } }, fetchUser: jest.fn() }),
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
                <button onClick={() => void onRefreshToken()}>sumsub-refresh</button>
            </div>
        ) : null,
}))

const mockQuestions = getKycQuestions as jest.MockedFunction<typeof getKycQuestions>
const mockSave = saveKycAnswers as jest.MockedFunction<typeof saveKycAnswers>
const mockToken = startVerifyOnceIdentity as jest.MockedFunction<typeof startVerifyOnceIdentity>
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
): VerifyOnceQuestions => ({
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
    firstUnanswered: firstUnanswered as VerifyOnceQuestions['firstUnanswered'],
    progress: { done: 2, total: 5 },
})

function renderFlow(search = '') {
    return renderWithIntl(
        <NuqsTestingAdapter searchParams={search} hasMemory>
            <VerifyOnceFlow />
        </NuqsTestingAdapter>
    )
}

const continueButton = () => screen.getByTestId('verify-continue')

const mockStartAction = jest.fn()

beforeEach(() => {
    jest.clearAllMocks()
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
        expect(await screen.findByText('We’re checking your ID')).toBeInTheDocument()
        const readsBeforePoll = mockStatus.mock.calls.length
        await act(async () => {
            jest.advanceTimersByTime(30_000)
        })
        expect(mockStatus.mock.calls.length).toBeGreaterThan(readsBeforePoll)
        expect(mockToken).not.toHaveBeenCalled()
    })

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

    it.each(['FAILED', 'REJECTED'])('%s offers Home and cannot retry identity', async (status) => {
        mockStatus.mockResolvedValue(status as never)
        renderFlow()
        const home = await screen.findByRole('button', { name: /home/i })
        expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
        fireEvent.click(home)
        expect(mockPush).toHaveBeenCalledWith('/home')
        expect(mockToken).not.toHaveBeenCalled()
    })

    it('a document-required retry presents the ID picker', async () => {
        mockStatus.mockResolvedValue('ACTION_REQUIRED')
        mockToken.mockResolvedValue({ kind: 'document-required' } as never)
        renderFlow()
        fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
        expect(await screen.findByTestId('verify-id-continue')).toBeInTheDocument()
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
        jest.mocked(saveVerifyOnceFeatures).mockResolvedValue({ kind: 'saved' })
        renderFlow()
        await screen.findByTestId('verify-toggle-isFatca')
        fireEvent.click(continueButton())
        const optOut = await screen.findByRole('button', { name: /continue without local bank transfers/i })
        const readsBeforeOptOut = mockQuestions.mock.calls.length
        mockQuestions.mockResolvedValue(build())
        fireEvent.click(optOut)
        await waitFor(() => expect(saveVerifyOnceFeatures).toHaveBeenCalledWith({ ...selected, local: false }))
        await waitFor(() => expect(mockQuestions.mock.calls.length).toBeGreaterThan(readsBeforeOptOut))
        expect(await screen.findByTestId('verify-pick-annualSalary')).toBeInTheDocument()
        expect(mockToken).not.toHaveBeenCalled()
    })
})

describe('form protocol failure copy acceptance', () => {
    it.each(['invalid_body', 'unknown_step', 'rate_limited'])(
        '%s retains answers and explains a form or request issue instead of claiming a network error',
        async (code) => {
            mockSave.mockResolvedValue({ kind: 'blocked', code } as never)
            renderFlow()
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
