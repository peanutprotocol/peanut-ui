import { screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaperworkVerificationQuestions } from '@/app/actions/types/kyc-paperwork-verification.types'
import { serverFetch } from '@/utils/api-fetch'
import { getKycDocumentPlan } from '@/app/actions/kyc-workflow'
import { AddFeatureFlow, AddFeatureQuestions } from '../AddFeatureFlow'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('../paperworkVerificationHeaders', () => ({
    paperworkVerificationHeaders: () => ({ 'x-kyc-paperwork-verification': '1' }),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({ getKycDocumentPlan: jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))

const mockFetch = jest.mocked(serverFetch)
const mockPlan = getKycDocumentPlan as jest.MockedFunction<typeof getKycDocumentPlan>

const features = { qr: true, bank: false, local: false, card: false }
const choice = (key: string, value: string | null) => ({
    key,
    kind: 'choice' as const,
    required: true,
    options: ['personal_spending', 'travel', 'under_25k', '25k_50k', 'under_1k'],
    value,
})

const cardQuestions = (): PaperworkVerificationQuestions => ({
    available: true,
    attemptId: null,
    residence: 'US',
    steps: [
        { id: 'purpose', features: ['card'], answered: false, fields: [choice('cardPurpose', 'travel')] },
        {
            id: 'money',
            features: ['card'],
            answered: false,
            fields: [choice('annualSalary', '25k_50k'), choice('expectedMonthlyVolume', 'under_1k')],
        },
        { id: 'birth', features: ['base'], answered: true, fields: [] },
        {
            id: 'phone',
            features: ['card'],
            answered: false,
            fields: [{ key: 'phone', kind: 'phone', required: true, value: null }],
        },
    ],
    firstUnanswered: 'purpose',
    progress: { done: 1, total: 4 },
})

beforeEach(() => {
    jest.clearAllMocks()
    mockPlan.mockResolvedValue({ available: true, features, routes: [], policyVersion: 'v1', activeAttemptId: null })
    mockFetch.mockReset()
})

const mockPush = jest.fn()
const mockStartAction = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))
jest.mock('@/hooks/useSumsubKycFlow', () => ({
    useSumsubKycFlow: () => ({
        isLoading: false,
        error: null,
        showWrapper: false,
        accessToken: null,
        handleStartAction: mockStartAction,
        handleClose: jest.fn(),
        handleSdkComplete: jest.fn(),
        refreshToken: jest.fn(),
    }),
}))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
const reply = (status: number, body: unknown) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as Response
const answerSave = (body: unknown, status = 200) => {
    mockFetch.mockImplementation(async (path) =>
        String(path).startsWith('/users/kyc/questions')
            ? reply(200, { ...cardQuestions(), steps: [], firstUnanswered: null })
            : reply(status, body)
    )
}

describe('added feature outcome acceptance through transport', () => {
    it('keeps an unchanged card refusal separate from a newly added bank feature', async () => {
        mockPlan.mockResolvedValue({
            available: true,
            features: { ...features, card: true },
            routes: [],
            policyVersion: 'v1',
            activeAttemptId: null,
        })
        answerSave({
            features: {
                bank: { state: 'setting_up' },
                card: { state: 'refused', reason: 'identity_document_insufficient' },
            },
        })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="bank" onBack={jest.fn()} onDone={onDone} />)
        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
        expect(screen.queryByText(/different ID document/i)).not.toBeInTheDocument()
    })

    it('a successful HTTP save that refuses the new bank feature displays its refusal and does not complete', async () => {
        answerSave({ features: { bank: { state: 'refused', reason: 'identity_document_insufficient' } } })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="bank" onBack={jest.fn()} onDone={onDone} />)
        expect(await screen.findByText(/different ID document/i)).toBeInTheDocument()
        expect(onDone).not.toHaveBeenCalled()
        expect(screen.queryByText('You’re all set')).not.toBeInTheDocument()
    })

    it('a successful HTTP save that requires a supplement opens the owed action without claiming completion', async () => {
        answerSave({ features: { bank: { state: 'action_required', action: 'supplement:bridge' } } })
        renderWithIntl(<AddFeatureFlow feature="bank" onExit={jest.fn()} />)
        await waitFor(() => expect(mockStartAction).toHaveBeenCalledWith('supplement:bridge'))
        expect(screen.queryByText('You’re all set')).not.toBeInTheDocument()
    })
})
