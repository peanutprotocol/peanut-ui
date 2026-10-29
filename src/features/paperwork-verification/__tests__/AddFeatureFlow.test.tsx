import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaperworkVerificationQuestions } from '@/app/actions/types/kyc-paperwork-verification.types'
import {
    getKycQuestions,
    saveKycAnswers,
    savePaperworkVerificationFeatures,
} from '@/app/actions/kyc-paperwork-verification'
import { getKycDocumentPlan } from '@/app/actions/kyc-workflow'
import { AddFeatureFlow, AddFeatureQuestions } from '../AddFeatureFlow'

jest.mock('@/app/actions/kyc-paperwork-verification', () => ({
    getKycQuestions: jest.fn(),
    saveKycAnswers: jest.fn(),
    savePaperworkVerificationFeatures: jest.fn(),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({ getKycDocumentPlan: jest.fn() }))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))

const mockQuestions = getKycQuestions as jest.MockedFunction<typeof getKycQuestions>
const mockSave = saveKycAnswers as jest.MockedFunction<typeof saveKycAnswers>
const mockPlan = getKycDocumentPlan as jest.MockedFunction<typeof getKycDocumentPlan>
const mockSaveFeatures = savePaperworkVerificationFeatures as jest.MockedFunction<
    typeof savePaperworkVerificationFeatures
>

const features = { qr: true, bank: true, local: false, card: false }
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
    mockSaveFeatures.mockResolvedValue({ kind: 'saved' })
})

describe('AddFeatureQuestions', () => {
    it('asks the pickers on one screen and the typed answers on the next, never an ID check', async () => {
        mockQuestions.mockResolvedValue(cardQuestions())
        mockSave.mockResolvedValue({ kind: 'saved', next: null })
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={jest.fn()} onDone={jest.fn()} />)
        expect(await screen.findByText('For your card')).toBeInTheDocument()
        expect(mockQuestions).toHaveBeenCalledWith('card')
        expect(screen.getByTestId('verify-pick-cardPurpose')).toBeInTheDocument()
        expect(screen.getByTestId('verify-pick-annualSalary')).toBeInTheDocument()
        expect(screen.getByTestId('verify-pick-expectedMonthlyVolume')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-input-phone')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-continue'))
        expect(await screen.findByTestId('verify-input-phone')).toBeInTheDocument()
        expect(screen.getByText('For your card')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-pick-cardPurpose')).not.toBeInTheDocument()
        // Without the address beside it, the phone keeps its country-code help and the no-spam promise.
        expect(screen.getByText('Include your country code, like +1.')).toBeInTheDocument()
        expect(screen.getByTestId('verify-phone-no-spam')).toHaveTextContent('No spam')
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('saves each open step for the feature in order, then adds the feature', async () => {
        mockQuestions.mockResolvedValue(cardQuestions())
        mockSave.mockResolvedValue({ kind: 'saved', next: null })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={jest.fn()} onDone={onDone} />)
        fireEvent.click(await screen.findByTestId('verify-continue'))
        fireEvent.change(await screen.findByTestId('verify-input-phone'), { target: { value: '+1 415 555 0132' } })
        expect(onDone).not.toHaveBeenCalled()
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(onDone).toHaveBeenCalled())
        expect(mockSave.mock.calls.map(([step, values, feature]) => [step, values, feature])).toEqual([
            ['purpose', { cardPurpose: 'travel' }, 'card'],
            ['money', { annualSalary: '25k_50k', expectedMonthlyVolume: 'under_1k' }, 'card'],
            ['phone', { phone: '+14155550132' }, 'card'],
        ])
        expect(mockSaveFeatures).toHaveBeenCalledWith({ ...features, card: true }, features)
    })

    it('stops at the first refused step and shows its error; the feature is not added', async () => {
        mockQuestions.mockResolvedValue(cardQuestions())
        mockSave
            .mockResolvedValueOnce({ kind: 'saved', next: 'money' })
            .mockResolvedValueOnce({ kind: 'saved', next: 'phone' })
            .mockResolvedValueOnce({ kind: 'invalid', errors: { phone: 'invalid_phone' } })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={jest.fn()} onDone={onDone} />)
        fireEvent.click(await screen.findByTestId('verify-continue'))
        fireEvent.change(await screen.findByTestId('verify-input-phone'), { target: { value: '+1 415 5550' } })
        fireEvent.click(screen.getByTestId('verify-continue'))
        expect(await screen.findByText('Enter the full number with your country code, like +1.')).toBeInTheDocument()
        expect(onDone).not.toHaveBeenCalled()
        expect(mockSaveFeatures).not.toHaveBeenCalled()
    })

    it('Back returns to the picker screen with its answers, then leaves', async () => {
        mockQuestions.mockResolvedValue(cardQuestions())
        mockSave.mockResolvedValue({ kind: 'saved', next: null })
        const onBack = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={onBack} onDone={jest.fn()} />)
        fireEvent.click(await screen.findByTestId('verify-continue'))
        await screen.findByTestId('verify-input-phone')
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(await screen.findByTestId('verify-pick-annualSalary')).toHaveTextContent('$25,000')
        expect(onBack).not.toHaveBeenCalled()
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(onBack).toHaveBeenCalled()
    })

    it('with nothing missing, adds the feature straight away', async () => {
        const answered = cardQuestions()
        answered.steps = answered.steps.map((s) => ({ ...s, answered: true }))
        mockQuestions.mockResolvedValue(answered)
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={jest.fn()} onDone={onDone} />)
        await waitFor(() => expect(onDone).toHaveBeenCalled())
        expect(mockSave).not.toHaveBeenCalled()
        expect(mockSaveFeatures).toHaveBeenCalledWith({ ...features, card: true }, features)
    })

    it('a card that owes only its application opens the card application', async () => {
        const answered = cardQuestions()
        answered.steps = answered.steps.map((s) => ({ ...s, answered: true }))
        mockQuestions.mockResolvedValue(answered)
        mockSaveFeatures.mockResolvedValue({ kind: 'card-application' })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={jest.fn()} onDone={onDone} />)
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/card'))
        expect(onDone).not.toHaveBeenCalled()
        expect(screen.queryByText(/isn’t available/)).toBeNull()
    })

    it('checks the saved feature outcome again before claiming completion', async () => {
        mockPlan.mockResolvedValue({
            available: true,
            features: { ...features, card: true },
            routes: [],
            policyVersion: 'v1',
            activeAttemptId: null,
        })
        const answered = cardQuestions()
        answered.steps = []
        mockQuestions.mockResolvedValue(answered)
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={jest.fn()} onDone={onDone} />)
        await waitFor(() => expect(onDone).toHaveBeenCalled())
        expect(mockSaveFeatures).toHaveBeenCalledWith({ ...features, card: true }, features)
    })
})

describe('AddFeatureQuestions: a Bridge high-risk bank account', () => {
    it('asks the job and Bridge’s money answers, labelled, and saves them for the bank feature', async () => {
        mockQuestions.mockResolvedValue({
            available: true,
            attemptId: null,
            residence: 'PH',
            steps: [
                {
                    id: 'work',
                    features: ['bank'],
                    answered: false,
                    fields: [
                        {
                            key: 'employmentStatus',
                            kind: 'choice',
                            required: true,
                            options: ['employed'],
                            value: 'employed',
                        },
                        {
                            key: 'occupation',
                            kind: 'occupation',
                            required: true,
                            options: ['lawyer', 'software_developer_applications'],
                            value: 'lawyer',
                        },
                    ],
                },
                {
                    id: 'money',
                    features: ['bank'],
                    answered: false,
                    fields: [
                        {
                            key: 'bankMonthlyPayments',
                            kind: 'choice',
                            required: true,
                            options: ['0_4999'],
                            value: '0_4999',
                        },
                        {
                            key: 'actingAsIntermediary',
                            kind: 'choice',
                            required: true,
                            options: ['yes', 'no'],
                            value: 'no',
                        },
                    ],
                },
            ],
            firstUnanswered: 'work',
            progress: { done: 1, total: 3 },
        })
        mockSave.mockResolvedValue({ kind: 'saved', next: null })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="bank" onBack={jest.fn()} onDone={onDone} />)
        expect(await screen.findByTestId('verify-pick-occupation')).toHaveTextContent('Lawyer')
        expect(screen.getByTestId('verify-pick-bankMonthlyPayments')).toHaveTextContent('Under $5,000')
        expect(screen.getByTestId('verify-pick-actingAsIntermediary')).toHaveTextContent('Only for myself')
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(onDone).toHaveBeenCalled())
        expect(mockSave).toHaveBeenCalledWith('work', { employmentStatus: 'employed', occupation: 'lawyer' }, 'bank')
        expect(mockSave).toHaveBeenCalledWith(
            'money',
            { bankMonthlyPayments: '0_4999', actingAsIntermediary: 'no' },
            'bank'
        )
    })
})

describe('AddFeatureQuestions: local transfers (Manteca)', () => {
    it('asks marital status and the three declarations, sending no for each untouched toggle', async () => {
        mockQuestions.mockResolvedValue({
            available: true,
            attemptId: null,
            residence: 'AR',
            steps: [
                {
                    id: 'birth',
                    features: ['local'],
                    answered: false,
                    fields: [
                        {
                            key: 'maritalStatus',
                            kind: 'choice',
                            required: true,
                            options: ['single', 'married'],
                            value: 'married',
                        },
                    ],
                },
                {
                    id: 'declarations',
                    features: ['local'],
                    answered: false,
                    fields: ['isFatca', 'isPep', 'isFep'].map((key) => ({
                        key,
                        kind: 'toggle' as const,
                        required: true,
                        value: null,
                    })),
                },
            ],
            firstUnanswered: 'birth',
            progress: { done: 1, total: 3 },
        })
        mockSave.mockResolvedValue({ kind: 'saved', next: null })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="local" onBack={jest.fn()} onDone={onDone} />)
        expect(await screen.findByText('For local transfers')).toBeInTheDocument()
        expect(screen.getByTestId('verify-pick-maritalStatus')).toHaveTextContent('Married')
        expect(screen.queryByText('I must report to the UIF')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-continue'))
        expect(await screen.findByText('I must report to the UIF')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-toggle-isPep'))
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(onDone).toHaveBeenCalled())
        expect(mockSave).toHaveBeenCalledWith('declarations', { isFatca: 'no', isPep: 'yes', isFep: 'no' }, 'local')
        expect(mockSaveFeatures).toHaveBeenCalledWith({ ...features, local: true }, features)
    })
})

describe('AddFeatureQuestions: the US question for local transfers', () => {
    it('says up front that local transfers are not for US persons, and shows the refusal on Continue', async () => {
        mockQuestions.mockResolvedValue({
            available: true,
            attemptId: null,
            residence: 'AR',
            steps: [
                {
                    id: 'declarations',
                    features: ['local'],
                    answered: false,
                    fields: [{ key: 'isFatca', kind: 'toggle', required: true, value: null }],
                },
            ],
            firstUnanswered: 'declarations',
            progress: { done: 1, total: 2 },
        })
        mockSave.mockResolvedValue({ kind: 'invalid', errors: { isFatca: 'us_citizen_not_supported' } })
        renderWithIntl(<AddFeatureQuestions feature="local" onBack={jest.fn()} onDone={jest.fn()} />)
        expect(await screen.findByText('I’m a US citizen or tax resident')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-toggle-isFatca'))
        expect(screen.getByTestId('verify-note-isFatca')).toHaveTextContent('US citizens or tax residents')
        fireEvent.click(screen.getByTestId('verify-continue'))
        expect(await screen.findByTestId('verify-error-isFatca')).toHaveTextContent('US citizens or tax residents')
        expect(screen.queryByTestId('verify-note-isFatca')).not.toBeInTheDocument()
        expect(mockSave).toHaveBeenCalledWith('declarations', { isFatca: 'yes' }, 'local')
    })
})

describe('AddFeatureQuestions: the API asks for a step again', () => {
    const answered = () => {
        const all = cardQuestions()
        all.steps = all.steps.map((s) => ({ ...s, answered: true }))
        return all
    }

    it('asks the step the card application names even when the read says answered (a refused job title)', async () => {
        const questions = answered()
        questions.steps[1] = { ...questions.steps[1], answered: true }
        mockQuestions.mockResolvedValue({
            ...questions,
            steps: [
                ...questions.steps,
                {
                    id: 'work',
                    features: ['card'],
                    answered: true,
                    fields: [
                        { key: 'occupation', kind: 'occupation', required: true, options: ['lawyer'], value: null },
                    ],
                },
            ],
        })
        renderWithIntl(<AddFeatureQuestions feature="card" requiredStep="work" onBack={jest.fn()} onDone={jest.fn()} />)
        expect(await screen.findByTestId('verify-pick-occupation')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-pick-cardPurpose')).not.toBeInTheDocument()
    })

    it('saving the feature refused for a missing step shows that step', async () => {
        mockQuestions.mockResolvedValue(answered())
        mockSaveFeatures.mockResolvedValueOnce({ kind: 'questions-missing', step: 'money' })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={jest.fn()} onDone={onDone} />)
        expect(await screen.findByTestId('verify-pick-annualSalary')).toBeInTheDocument()
        expect(onDone).not.toHaveBeenCalled()
    })

    it('stops on the failure screen instead of looping when the same step stays missing', async () => {
        mockQuestions.mockResolvedValue({ ...answered(), steps: [] })
        mockSaveFeatures.mockResolvedValue({ kind: 'questions-missing', step: 'money' })
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={jest.fn()} onDone={jest.fn()} />)
        expect(await screen.findByText('We couldn’t load this')).toBeInTheDocument()
        expect(mockSaveFeatures).toHaveBeenCalledTimes(2)
    })

    it('a user the server keeps on today’s flow leaves the screen', async () => {
        mockQuestions.mockResolvedValue(cardQuestions())
        mockSave.mockResolvedValue({ kind: 'conflict', code: 'existing_verification' })
        const onBack = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="card" onBack={onBack} onDone={jest.fn()} />)
        fireEvent.click(await screen.findByTestId('verify-continue'))
        await waitFor(() => expect(onBack).toHaveBeenCalled())
    })
})

describe('AddFeatureFlow', () => {
    it('returns to the feature entry for ready without claiming onboarding is running', async () => {
        mockQuestions.mockResolvedValue({ ...cardQuestions(), steps: [] })
        mockSaveFeatures.mockResolvedValue({ kind: 'ready' })
        const onExit = jest.fn()
        renderWithIntl(<AddFeatureFlow feature="bank" onExit={onExit} />)
        await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1))
        expect(screen.queryByText("We're setting things up")).not.toBeInTheDocument()
    })
    it('ends on the provider status for a bank account and returns where the user came from', async () => {
        mockQuestions.mockResolvedValue({ ...cardQuestions(), steps: [] })
        const onExit = jest.fn()
        renderWithIntl(<AddFeatureFlow feature="bank" onExit={onExit} />)
        expect(await screen.findByText("We're setting things up")).toBeInTheDocument()
        expect(screen.getByText(/setting up your bank account/)).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-feature-done'))
        expect(onExit).toHaveBeenCalled()
    })
})

// Slava, 2026-10-27: after approval, an EEA bank user whose ID names no nationality confirms it.
describe('AddFeatureQuestions: the nationality asked after the ID check', () => {
    const afterApproval = (): PaperworkVerificationQuestions => ({
        available: true,
        attemptId: null,
        residence: 'DE',
        steps: [
            {
                id: 'birth',
                features: ['base'],
                answered: true,
                fields: [{ key: 'citizenship', kind: 'country', required: true, value: 'DE' }],
            },
            {
                id: 'nationality',
                features: ['bank'],
                answered: false,
                fields: [{ key: 'nationality', kind: 'country', required: true, value: 'DE' }],
            },
        ],
        firstUnanswered: 'nationality',
        progress: { done: 2, total: 3 },
    })

    it('arrives filled with the citizenship under its own heading, and Continue saves it', async () => {
        mockQuestions.mockResolvedValue(afterApproval())
        mockSave.mockResolvedValue({ kind: 'saved', next: null })
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="bank" onBack={jest.fn()} onDone={onDone} />)
        expect(await screen.findByText('Confirm your nationality')).toBeInTheDocument()
        expect(screen.queryByText('For your bank account')).not.toBeInTheDocument()
        expect(screen.getByTestId('verify-pick-nationality')).toHaveTextContent('Germany')
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(onDone).toHaveBeenCalled())
        expect(mockSave).toHaveBeenCalledWith('nationality', { nationality: 'DE' }, 'bank')
    })
})

describe('AddFeatureQuestions: a saved tax number', () => {
    const withTax = (): PaperworkVerificationQuestions => ({
        available: true,
        attemptId: null,
        residence: 'AR',
        steps: [
            {
                id: 'tax',
                features: ['base'],
                answered: true,
                fields: [
                    { key: 'taxId', kind: 'taxId', required: true, format: 'cuit', value: '•••• 1234', masked: true },
                ],
            },
        ],
        firstUnanswered: null,
        progress: { done: 2, total: 2 },
    })

    it('shows as saved and is never sent back', async () => {
        mockQuestions.mockResolvedValue(withTax())
        const onDone = jest.fn()
        renderWithIntl(<AddFeatureQuestions feature="local" requiredStep="tax" onBack={jest.fn()} onDone={onDone} />)
        const input = await screen.findByTestId('verify-input-taxId')
        expect(input).toHaveValue('•••• 1234')
        expect(input).toHaveAttribute('readonly')
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(onDone).toHaveBeenCalled())
        expect(mockSave).not.toHaveBeenCalled()
    })

    it('can be replaced by typing a new number', async () => {
        mockQuestions.mockResolvedValue(withTax())
        mockSave.mockResolvedValue({ kind: 'saved', next: null })
        renderWithIntl(<AddFeatureQuestions feature="local" requiredStep="tax" onBack={jest.fn()} onDone={jest.fn()} />)
        fireEvent.click(await screen.findByTestId('verify-tax-replace'))
        const input = screen.getByTestId('verify-input-taxId')
        expect(input).toHaveValue('')
        expect(input).not.toHaveAttribute('readonly')
        fireEvent.change(input, { target: { value: '20123456786' } })
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(mockSave).toHaveBeenCalledWith('tax', { taxId: '20-12345678-6' }, 'local'))
    })
})
