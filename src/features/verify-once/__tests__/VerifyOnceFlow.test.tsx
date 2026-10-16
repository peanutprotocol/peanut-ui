import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import type { VerifyOnceQuestions } from '@/app/actions/types/kyc-verify-once.types'
import { getKycQuestions, saveKycAnswers, startVerifyOnceIdentity } from '@/app/actions/kyc-verify-once'
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
    startVerifyOnceIdentity: jest.fn(),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({
    findKycDocumentPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(),
}))
jest.mock('../verifyOnceFlag', () => ({ isVerifyOnceEnabled: () => true }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { username: 'tester' } }, fetchUser: jest.fn() }),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => mockExit }))
jest.mock('@/hooks/useSumsubKycFlow', () => ({ useSumsubKycFlow: jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: ({ visible, onComplete }: { visible: boolean; onComplete: () => void }) =>
        visible ? <button onClick={onComplete}>sumsub-submit</button> : null,
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
                    types: ['PASSPORT'],
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

describe('VerifyOnceFlow', () => {
    it('resumes at the first unanswered step the server names (app killed mid-way)', async () => {
        renderFlow()
        expect(await screen.findByRole('progressbar', { name: 'Step 3 of 5' })).toBeInTheDocument()
        expect(screen.getByTestId('verify-pick-annualSalary')).toHaveTextContent('$25,000–$49,999')
    })

    it('Continue saves the step once even on a double tap, then moves to the next open step', async () => {
        let release: (value: { kind: 'saved'; next: 'tax' }) => void = () => {}
        mockSave.mockImplementation(() => new Promise((resolve) => (release = resolve)))
        renderFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        fireEvent.click(continueButton())
        fireEvent.click(continueButton())
        expect(mockSave).toHaveBeenCalledTimes(1)
        expect(mockSave).toHaveBeenCalledWith('money', { annualSalary: '25k_50k' }, undefined)
        await act(async () => release({ kind: 'saved', next: 'tax' }))
        expect(await screen.findByText('What’s your Social Security number?')).toBeInTheDocument()
    })

    it('Back shows the previous step with its saved values', async () => {
        mockSave.mockResolvedValue({ kind: 'saved', next: 'tax' })
        renderFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        fireEvent.click(continueButton())
        await screen.findByText('What’s your Social Security number?')
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(await screen.findByTestId('verify-pick-annualSalary')).toHaveTextContent('$25,000–$49,999')
    })

    it('shows the server’s field error inline and stays on the step', async () => {
        mockQuestions.mockResolvedValue(build({ money: true }, 'tax'))
        mockSave.mockResolvedValue({ kind: 'invalid', errors: { taxId: 'itin_not_accepted' } })
        renderFlow()
        const input = await screen.findByTestId('verify-input-taxId')
        fireEvent.change(input, { target: { value: '812701234' } })
        expect(input).toHaveValue('812-70-1234')
        fireEvent.click(continueButton())
        expect(await screen.findByText('That’s an ITIN. Enter your Social Security number.')).toBeInTheDocument()
        expect(screen.getByText('What’s your Social Security number?')).toBeInTheDocument()
    })

    it('flags an ITIN as it is typed', async () => {
        mockQuestions.mockResolvedValue(build({ money: true }, 'tax'))
        renderFlow()
        fireEvent.change(await screen.findByTestId('verify-input-taxId'), { target: { value: '912701234' } })
        expect(screen.getByText('That’s an ITIN. Enter your Social Security number.')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
    })

    it('offline or a 5xx: a retry message, the step and its values stay, nothing is stored', async () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
        mockQuestions.mockResolvedValue(build({ money: true }, 'tax'))
        mockSave.mockResolvedValueOnce({ kind: 'retry' })
        renderFlow()
        fireEvent.change(await screen.findByTestId('verify-input-taxId'), { target: { value: '412550198' } })
        fireEvent.click(continueButton())
        expect(await screen.findByTestId('verify-form-error')).toHaveTextContent('We couldn’t save that.')
        expect(screen.getByTestId('verify-input-taxId')).toHaveValue('412-55-0198')
        expect(setItem.mock.calls.flat().join(' ')).not.toContain('412')

        mockSave.mockResolvedValueOnce({ kind: 'saved', next: null })
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        fireEvent.click(continueButton())
        expect(await screen.findByText('That’s the hard part done')).toBeInTheDocument()
        setItem.mockRestore()
    })

    it('the last answer leads to the midpoint, which opens Sumsub on the picked document and then the review', async () => {
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        mockToken.mockResolvedValue({
            kind: 'session',
            session: {
                attemptId: 'attempt-1',
                token: 'tok',
                applicantId: 'app',
                levelName: 'base',
                sdkConfig: {
                    documentDefinitions: { IDENTITY: { country: 'USA', idDocType: 'PASSPORT' } },
                    autoSelectDocumentDefinitions: true,
                },
            } as never,
        })
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-id-continue'))
        expect(mockToken).toHaveBeenCalledWith('attempt-1', { type: 'PASSPORT', issuingCountry: 'US' })
        fireEvent.click(await screen.findByText('sumsub-submit'))
        expect(await screen.findByText('We’re checking your ID')).toBeInTheDocument()
    })

    it('a token refused for missing answers goes back to that step', async () => {
        mockQuestions.mockResolvedValueOnce(build({ money: true, tax: true }, null))
        mockToken.mockResolvedValue({ kind: 'questions-missing', step: 'money' })
        renderFlow()
        mockQuestions.mockResolvedValue(build({ tax: true }, 'money'))
        fireEvent.click(await screen.findByTestId('verify-id-continue'))
        expect(await screen.findByTestId('verify-pick-annualSalary')).toBeInTheDocument()
    })

    it('an ID already submitted elsewhere reloads into the review', async () => {
        mockSave.mockResolvedValue({ kind: 'conflict', code: 'identity_submitted' })
        renderFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        mockStatus.mockResolvedValue('IN_REVIEW')
        fireEvent.click(continueButton())
        expect(await screen.findByText('We’re checking your ID')).toBeInTheDocument()
    })

    it('sends a user the server keeps on today’s flow back to Home', async () => {
        mockPlan.mockResolvedValue({ ...plan, flow: 'document-first' })
        renderFlow()
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
    })

    it('an approved user lands on "You’re verified!", or on the proof-of-address suggestion', async () => {
        mockStatus.mockResolvedValue('APPROVED')
        const { unmount } = renderFlow()
        expect(await screen.findByText('You’re verified!')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-verified-home'))
        expect(mockPush).toHaveBeenCalledWith('/home')
        unmount()

        mockPlan.mockResolvedValue({ ...plan, proofOfAddress: 'suggested' })
        renderFlow()
        expect(await screen.findByText('Add a proof of address')).toBeInTheDocument()
    })

    it('rule 1: Upload starts the existing supplement action, Skip goes on with no task left behind', async () => {
        mockStatus.mockResolvedValue('APPROVED')
        mockPlan.mockResolvedValue({ ...plan, proofOfAddress: 'suggested' })
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-poa-upload'))
        expect(mockStartAction).toHaveBeenCalledWith('supplement:bridge')
        fireEvent.click(screen.getByTestId('verify-poa-skip'))
        expect(await screen.findByText('You’re verified!')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })
})
