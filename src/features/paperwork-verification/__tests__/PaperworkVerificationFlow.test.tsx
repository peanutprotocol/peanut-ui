import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaperworkVerificationQuestions } from '@/app/actions/types/kyc-paperwork-verification.types'
import {
    getKycQuestions,
    saveKycAnswers,
    skipProofOfAddress,
    startPaperworkVerificationIdentity,
} from '@/app/actions/kyc-paperwork-verification'
import { findKycDocumentPlan, getKycDocumentStatus, refreshKycIdentityStatus } from '@/app/actions/kyc-workflow'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { PaperworkVerificationFlow } from '../PaperworkVerificationFlow'
import {
    PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
    PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY,
} from '../usePaperworkVerificationStart'

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
    startPaperworkVerificationIdentity: jest.fn(),
    skipProofOfAddress: jest.fn(async () => true),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({
    refreshKycIdentityStatus: jest.fn(async () => undefined),
    findKycDocumentPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(),
}))
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({ user: { user: { username: 'tester' } }, fetchUser: jest.fn() }),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => mockExit }))
jest.mock('@/hooks/useSumsubKycFlow', () => ({ useSumsubKycFlow: jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/features/paperwork-verification/components/VerifySetupPrelude', () => ({
    VerifySetupPrelude: ({ needs, onDone }: { needs: string[]; onDone: () => Promise<void> }) => (
        <button data-testid="verify-setup-prelude" onClick={() => void onDone()}>
            {needs.join(',')}
        </button>
    ),
}))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: ({ visible, onComplete }: { visible: boolean; onComplete: () => void }) =>
        visible ? <button onClick={onComplete}>sumsub-submit</button> : null,
}))

const mockQuestions = getKycQuestions as jest.MockedFunction<typeof getKycQuestions>
const mockSave = saveKycAnswers as jest.MockedFunction<typeof saveKycAnswers>
const mockToken = startPaperworkVerificationIdentity as jest.MockedFunction<typeof startPaperworkVerificationIdentity>
const mockPlan = findKycDocumentPlan as jest.MockedFunction<typeof findKycDocumentPlan>
const mockStatus = getKycDocumentStatus as jest.MockedFunction<typeof getKycDocumentStatus>
const mockRefresh = refreshKycIdentityStatus as jest.MockedFunction<typeof refreshKycIdentityStatus>

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

function renderFlow(search = '', client = new QueryClient()) {
    return renderWithIntl(
        <QueryClientProvider client={client}>
            <NuqsTestingAdapter searchParams={search} hasMemory>
                <PaperworkVerificationFlow />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
}

/** A visit with questions or the ID ahead opens on the steps overview; Continue goes on to the open step. */
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
    mockRefresh.mockResolvedValue(undefined)
    mockQuestions.mockResolvedValue(build())
})

const withAddressAndPhone = (addressAnswered: boolean): PaperworkVerificationQuestions => {
    const base = build({ purpose: true, money: true }, addressAnswered ? 'phone' : 'address')
    const text = (key: string, value: string) => ({
        key,
        kind: 'text' as const,
        required: true,
        value: addressAnswered ? value : null,
    })
    return {
        ...base,
        steps: [
            ...base.steps.slice(0, 2),
            {
                id: 'address',
                features: ['base'],
                answered: addressAnswered,
                fields: [
                    text('street', 'Main St 1'),
                    text('town', 'Austin'),
                    text('postCode', '78701'),
                    { key: 'country', kind: 'country', required: true, locked: true, value: 'US' },
                ],
            },
            {
                id: 'phone',
                features: ['card'],
                answered: false,
                fields: [{ key: 'phone', kind: 'phone', required: true, value: null }],
            },
            base.steps[2],
        ],
    }
}

// An older account: the plan needs a residence and a plan for money before the questions exist.
describe('PaperworkVerificationFlow: an account missing signup answers', () => {
    it('shows the signup screens first, then reloads into the steps overview', async () => {
        mockPlan.mockResolvedValueOnce({ ...plan, needs: ['residence', 'features'] })
        mockQuestions.mockRejectedValueOnce(new Error('no residence'))
        renderFlow()

        const prelude = await screen.findByTestId('verify-setup-prelude')
        expect(prelude).toHaveTextContent('residence,features')
        expect(mockReplace).not.toHaveBeenCalledWith('/home')

        fireEvent.click(prelude)
        expect(await screen.findByTestId('verify-steps')).toBeInTheDocument()
    })
})

describe('PaperworkVerificationFlow: the steps overview', () => {
    // Slava, 2026-10-26: the loading mascot showed before the steps on APK #6.
    it('opens at once as a skeleton of the steps, never the loading mascot, Continue off until filled', async () => {
        let answer: (value: PaperworkVerificationQuestions) => void = () => {}
        mockQuestions.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
        renderFlow()
        expect(screen.getByTestId('verify-steps-loading')).toBeInTheDocument()
        expect(screen.getByText(/A few steps to/)).toBeInTheDocument()
        expect(screen.getByTestId('verify-steps-continue')).toBeDisabled()
        expect(screen.queryByText('loading')).not.toBeInTheDocument()

        await act(async () => answer(build({ purpose: false }, 'purpose')))
        expect(await screen.findByTestId('verify-steps')).toBeInTheDocument()
        expect(screen.getByTestId('verify-steps-continue')).toBeEnabled()
    })

    it('opens on the steps, with the questions as the current step, and Continue resumes the open question', async () => {
        mockQuestions.mockResolvedValue(build({ purpose: false }, 'purpose'))
        renderFlow()
        const steps = await screen.findByTestId('verify-steps')
        expect(screen.getByText(/A few steps to/)).toBeInTheDocument()
        expect(steps.querySelector('[aria-current="step"]')).toHaveTextContent('Answer a few questions')
        expect(screen.getByText('Unlock eligible payments')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-steps-continue'))
        expect(await screen.findByRole('progressbar', { name: 'Step 2 of 4' })).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(await screen.findByTestId('verify-steps')).toBeInTheDocument()
        expect(mockExit).not.toHaveBeenCalled()
    })

    it('with every answer saved, the ID photo is the current step and Continue opens the document choice', async () => {
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        renderFlow()
        const steps = await screen.findByTestId('verify-steps')
        expect(steps.querySelector('[aria-current="step"]')).toHaveTextContent('Take a photo of your ID')
        fireEvent.click(screen.getByTestId('verify-steps-continue'))
        expect(await screen.findByTestId('verify-id')).toBeInTheDocument()
    })

    it('Back from the steps leaves the flow', async () => {
        renderFlow()
        await screen.findByTestId('verify-steps')
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(mockExit).toHaveBeenCalled()
    })

    it('a deep link to a step skips the overview', async () => {
        renderFlow('?step=tax')
        expect(await screen.findByText('What’s your Social Security number?')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-steps')).not.toBeInTheDocument()
    })

    it('a deep link to a step that shares a screen opens that screen', async () => {
        renderFlow('?step=money')
        expect(await screen.findByTestId('verify-pick-annualSalary')).toBeInTheDocument()
        expect(screen.getByTestId('verify-pick-cardPurpose')).toBeInTheDocument()
        expect(screen.getByRole('progressbar', { name: 'Step 2 of 4' })).toBeInTheDocument()
        // Each step's sentences sit under its own label.
        expect(screen.getByText('Purpose')).toBeInTheDocument()
        expect(screen.getByText('Money')).toBeInTheDocument()
    })

    it('says on the saved screen which picked features an answer closed', async () => {
        mockQuestions.mockResolvedValue({
            ...build({ money: true, tax: true }, null),
            closed: [{ feature: 'bank', reason: 'us_state_unsupported' }],
        })
        renderFlow('?step=saved')
        const notice = await screen.findByTestId('verify-closed-features')
        expect(notice).toHaveTextContent('Bank accounts aren’t available for New York addresses.')
        expect(notice).toHaveTextContent('Everything else you picked stays available.')
    })

    it('the last answer celebrates before the document choice, and Back from the ID skips the celebration', async () => {
        mockSave
            .mockResolvedValueOnce({ kind: 'saved', next: 'tax' })
            .mockResolvedValueOnce({ kind: 'saved', next: null })
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        fireEvent.click(continueButton())
        fireEvent.change(await screen.findByTestId('verify-input-taxId'), { target: { value: '412550198' } })
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        fireEvent.click(continueButton())
        expect(await screen.findByText('Answers saved!')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-saved-continue'))
        await screen.findByTestId('verify-id')
        // Let the URL write for the ID screen land before Back writes the next one.
        await act(async () => new Promise((resolve) => setTimeout(resolve, 100)))
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(await screen.findByText('What’s your Social Security number?')).toBeInTheDocument()
    })
})

describe('PaperworkVerificationFlow: the phone', () => {
    it('shares the address screen when both are asked, saves both in order and counts as one step', async () => {
        mockQuestions.mockResolvedValue(withAddressAndPhone(false))
        mockSave
            .mockResolvedValueOnce({ kind: 'saved', next: 'phone' })
            .mockResolvedValueOnce({ kind: 'saved', next: 'tax' })
        await startFlow()
        expect(await screen.findByText('Where do you live?')).toBeInTheDocument()
        expect(screen.getByRole('progressbar', { name: 'Step 3 of 5' })).toBeInTheDocument()
        expect(screen.getByText('For card security. We won’t send you codes.')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-phone-no-spam')).not.toBeInTheDocument()
        fireEvent.change(screen.getByTestId('verify-input-street'), { target: { value: 'Main St 1' } })
        fireEvent.change(screen.getByTestId('verify-input-town'), { target: { value: 'Austin' } })
        fireEvent.change(screen.getByTestId('verify-input-postCode'), { target: { value: '78701' } })
        fireEvent.change(screen.getByTestId('verify-input-phone'), { target: { value: '+1 415 555 0132' } })
        fireEvent.click(continueButton())
        expect(await screen.findByText('What’s your Social Security number?')).toBeInTheDocument()
        expect(mockSave.mock.calls.map(([step, values]) => [step, values])).toEqual([
            ['address', { street: 'Main St 1', town: 'Austin', postCode: '78701', country: 'US' }],
            ['phone', { phone: '+14155550132' }],
        ])
        expect(screen.getByRole('progressbar', { name: 'Step 4 of 5' })).toBeInTheDocument()
    })

    it('asked later on its own, keeps its own screen with the no-spam promise', async () => {
        mockQuestions.mockResolvedValue(withAddressAndPhone(true))
        await startFlow()
        expect(await screen.findByText('What’s your phone number?')).toBeInTheDocument()
        expect(screen.getByText('Your card partner uses it to keep your card secure.')).toBeInTheDocument()
        expect(screen.getByTestId('verify-phone-no-spam')).toHaveTextContent('No spam')
        expect(screen.queryByTestId('verify-input-street')).not.toBeInTheDocument()
    })
})

describe('PaperworkVerificationFlow', () => {
    it('resumes on the screen of the first unanswered step the server names (app killed mid-way)', async () => {
        await startFlow()
        expect(await screen.findByRole('progressbar', { name: 'Step 2 of 4' })).toBeInTheDocument()
        expect(screen.getByTestId('verify-pick-annualSalary')).toHaveTextContent('$25,000–$49,999')
    })

    // Slava, 2026-10-25: every Continue waited on the save. The next screen comes first now.
    it('Continue moves on before the server answers and saves the step once, even on a double tap', async () => {
        let release: (value: { kind: 'saved'; next: 'tax' }) => void = () => {}
        mockSave.mockImplementation(() => new Promise((resolve) => (release = resolve)))
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        fireEvent.click(continueButton())
        fireEvent.click(continueButton())
        expect(await screen.findByText('What’s your Social Security number?')).toBeInTheDocument()
        // The purpose shares the screen but was answered before, so only the money step is saved.
        expect(screen.queryByTestId('verify-pick-cardPurpose')).not.toBeInTheDocument()
        expect(mockSave).toHaveBeenCalledTimes(1)
        expect(mockSave).toHaveBeenCalledWith('money', { annualSalary: '25k_50k' }, undefined)
        await act(async () => release({ kind: 'saved', next: 'tax' }))
        expect(screen.getByText('What’s your Social Security number?')).toBeInTheDocument()
    })

    it('Back shows the previous step with its saved values', async () => {
        mockSave.mockResolvedValue({ kind: 'saved', next: 'tax' })
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        fireEvent.click(continueButton())
        await screen.findByText('What’s your Social Security number?')
        // Let the URL write for the tax screen land before Back writes the next one.
        await act(async () => new Promise((resolve) => setTimeout(resolve, 100)))
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(await screen.findByTestId('verify-pick-annualSalary')).toHaveTextContent('$25,000–$49,999')
    })

    it('shows the server’s field error inline and stays on the step', async () => {
        mockQuestions.mockResolvedValue(build({ money: true }, 'tax'))
        mockSave.mockResolvedValue({ kind: 'invalid', errors: { taxId: 'itin_not_accepted' } })
        await startFlow()
        const input = await screen.findByTestId('verify-input-taxId')
        fireEvent.change(input, { target: { value: '812701234' } })
        expect(input).toHaveValue('812-70-1234')
        fireEvent.click(continueButton())
        expect(await screen.findByText('That’s an ITIN. Enter your Social Security number.')).toBeInTheDocument()
        expect(screen.getByText('What’s your Social Security number?')).toBeInTheDocument()
    })

    it('flags an ITIN as it is typed', async () => {
        mockQuestions.mockResolvedValue(build({ money: true }, 'tax'))
        await startFlow()
        fireEvent.change(await screen.findByTestId('verify-input-taxId'), { target: { value: '912701234' } })
        expect(screen.getByText('That’s an ITIN. Enter your Social Security number.')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
    })

    it('offline or a 5xx past its retries: back on the step with a retry message and its values, nothing stored', async () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
        mockQuestions.mockResolvedValue(build({ money: true }, 'tax'))
        mockSave.mockResolvedValue({ kind: 'retry' })
        await startFlow()
        fireEvent.change(await screen.findByTestId('verify-input-taxId'), { target: { value: '412550198' } })
        jest.useFakeTimers()
        fireEvent.click(continueButton())
        expect(await screen.findByText('Answers saved!')).toBeInTheDocument()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        jest.useRealTimers()
        expect(mockSave).toHaveBeenCalledTimes(3)
        expect(await screen.findByTestId('verify-form-error')).toHaveTextContent('We couldn’t save that.')
        expect(screen.getByTestId('verify-input-taxId')).toHaveValue('412-55-0198')
        expect(setItem.mock.calls.flat().join(' ')).not.toContain('412')

        mockSave.mockResolvedValueOnce({ kind: 'saved', next: null })
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        fireEvent.click(continueButton())
        expect(await screen.findByText('Answers saved!')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-saved-continue'))
        expect(await screen.findByText(/Which document/)).toBeInTheDocument()
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
        await startFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        expect(mockToken).toHaveBeenCalledWith('attempt-1', { type: 'PASSPORT', issuingCountry: 'US' })
        fireEvent.click(await screen.findByText('sumsub-submit'))
        expect(await screen.findByText('Checking your ID')).toBeInTheDocument()
        expect(screen.getByTestId('verify-steps')).toHaveAttribute('data-phase', 'review')
        expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Get a secure review')
        await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
        fireEvent.click(screen.getByTestId('verify-review-home'))
        expect(mockPush).toHaveBeenCalledWith('/home')
    })

    // Slava, 2026-10-27: back from Home after the selfie, Verify restarted the questions and the ID.
    it('a NOT_STARTED identity Sumsub already has in review opens on the review, not the questions', async () => {
        mockStatus.mockResolvedValue('NOT_STARTED')
        mockRefresh.mockResolvedValue('PENDING')
        renderFlow()
        expect(await screen.findByText('Checking your ID')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-steps-continue')).toBeNull()
    })

    it('a NOT_STARTED identity Sumsub has nothing for keeps the questions', async () => {
        mockStatus.mockResolvedValue('NOT_STARTED')
        mockRefresh.mockResolvedValue(undefined)
        renderFlow()
        expect(await screen.findByTestId('verify-steps-continue')).toBeInTheDocument()
    })

    // APK #5: the plan /verify read before the last answer had no documents for a taken-over applicant.
    it('an ID screen opened on a plan without documents reads the plan again for them', async () => {
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        mockPlan.mockResolvedValueOnce({ ...plan, routes: [] })
        await startFlow()
        expect(await screen.findByTestId('verify-id-option-PASSPORT-US')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-id-error')).not.toBeInTheDocument()
    })

    // Slava, 2026-10-25: Verify showed the loading mascot before every visit.
    it('opens on what Home loaded, without the loading screen, and refreshes behind it', async () => {
        const client = new QueryClient()
        client.setQueryData(PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, plan)
        client.setQueryData(PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY, build())
        renderFlow('', client)
        expect(screen.getByTestId('verify-steps-continue')).toBeInTheDocument()
        expect(screen.queryByText('loading')).not.toBeInTheDocument()
        await waitFor(() => expect(mockQuestions).toHaveBeenCalled())
        expect(screen.getByTestId('verify-steps-continue')).toBeInTheDocument()
    })

    it('a token refused for missing answers goes back to that step', async () => {
        mockQuestions.mockResolvedValueOnce(build({ money: true, tax: true }, null))
        mockToken.mockResolvedValue({ kind: 'questions-missing', step: 'money' })
        await startFlow()
        mockQuestions.mockResolvedValue(build({ tax: true }, 'money'))
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        expect(await screen.findByTestId('verify-pick-annualSalary')).toBeInTheDocument()
    })

    it('an ID already submitted elsewhere reloads into the review', async () => {
        mockSave.mockResolvedValue({ kind: 'conflict', code: 'identity_submitted' })
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        mockStatus.mockResolvedValue('IN_REVIEW')
        fireEvent.click(continueButton())
        expect(await screen.findByText('Checking your ID')).toBeInTheDocument()
    })

    it('a check that already ended reloads into the review', async () => {
        mockSave.mockResolvedValue({ kind: 'conflict', code: 'verification_complete' })
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        mockStatus.mockResolvedValue('IN_REVIEW')
        fireEvent.click(continueButton())
        expect(await screen.findByText('Checking your ID')).toBeInTheDocument()
    })

    it("an answer refused with a code the app does not know shows the server's line on that step, unsaved", async () => {
        mockSave.mockResolvedValue({
            kind: 'conflict',
            code: 'policy_changed',
            message: 'This answer can’t change now.',
        })
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        fireEvent.click(continueButton())
        expect(await screen.findByTestId('verify-form-error')).toHaveTextContent('This answer can’t change now.')
        expect(screen.getByTestId('verify-pick-annualSalary')).toBeInTheDocument()
        // Unsaved, so Continue sends it again rather than skipping it as unchanged.
        mockSave.mockResolvedValue({ kind: 'saved', next: 'tax' })
        fireEvent.click(continueButton())
        await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2))
        expect(mockSave).toHaveBeenLastCalledWith('money', { annualSalary: '25k_50k' }, undefined)
    })

    it('an old conflict body with no message still names the refusal', async () => {
        mockSave.mockResolvedValue({ kind: 'conflict', code: 'policy_changed' })
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        fireEvent.click(continueButton())
        expect(await screen.findByTestId('verify-form-error')).toHaveTextContent(
            'This check isn’t available right now.'
        )
    })

    it('an answer refused because the picked document is no longer allowed goes back to the picker', async () => {
        mockSave.mockResolvedValue({
            kind: 'conflict',
            code: 'document_not_allowed',
            message: 'Pick another document.',
        })
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        const planReads = mockPlan.mock.calls.length
        fireEvent.click(continueButton())
        expect(await screen.findByTestId('verify-id-error')).toHaveTextContent('Pick another document.')
        expect(screen.getByTestId('verify-id-option-PASSPORT-US')).toBeInTheDocument()
        expect(mockPlan.mock.calls.length).toBeGreaterThan(planReads)
    })

    it("a pick the attempt no longer offers stays on the picker with the server's line, on a fresh plan", async () => {
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        mockToken.mockResolvedValue({ kind: 'document-not-allowed', message: 'That document isn’t accepted.' })
        await startFlow()
        const planReads = mockPlan.mock.calls.length
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        expect(await screen.findByTestId('verify-id-error')).toHaveTextContent('That document isn’t accepted.')
        await waitFor(() => expect(mockPlan.mock.calls.length).toBeGreaterThan(planReads))
        expect(screen.queryByText('sumsub-submit')).not.toBeInTheDocument()
    })

    it('a token refused because the check is over reloads the status', async () => {
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        mockToken.mockResolvedValue({ kind: 'complete' })
        await startFlow()
        mockStatus.mockResolvedValue('IN_REVIEW')
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        expect(await screen.findByText('Checking your ID')).toBeInTheDocument()
    })

    it("any other refused token shows the server's line", async () => {
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        mockToken.mockResolvedValue({ kind: 'failed', message: 'Try again in a minute.' })
        await startFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-US'))
        expect(await screen.findByTestId('verify-id-error')).toHaveTextContent('Try again in a minute.')
    })

    it('a card + bank user picks one job, from one list, shown by its label', async () => {
        const questions = build({ money: true, tax: true }, 'purpose')
        questions.steps.splice(1, 0, {
            id: 'work',
            features: ['card', 'bank'],
            answered: false,
            fields: [
                {
                    key: 'occupation',
                    kind: 'occupation',
                    required: true,
                    options: ['lawyer', 'software_developer_applications'],
                    value: 'software_developer_applications',
                },
            ],
        })
        questions.firstUnanswered = 'work'
        mockQuestions.mockResolvedValue(questions)
        await startFlow()
        await waitFor(() =>
            expect(screen.getByTestId('verify-pick-occupation')).toHaveTextContent('Software developer, applications')
        )
        expect(screen.getAllByTestId('verify-pick-occupation')).toHaveLength(1)
    })

    it('a retiree Bridge asks a job of is asked their last one, with "none" in place of Retired', async () => {
        const questions = build({ money: true, tax: true }, 'purpose')
        questions.steps.splice(1, 0, {
            id: 'work',
            features: ['bank'],
            answered: false,
            fields: [
                {
                    key: 'employmentStatus',
                    kind: 'choice',
                    required: true,
                    options: ['employed', 'retired'],
                    value: 'retired',
                },
                {
                    key: 'occupation',
                    kind: 'occupation',
                    required: true,
                    options: ['lawyer', 'retired', 'student', 'unemployed'],
                    value: null,
                    everyStatus: true,
                },
            ],
        })
        questions.firstUnanswered = 'work'
        mockQuestions.mockResolvedValue(questions)
        await startFlow()
        await waitFor(() => expect(document.body).toHaveTextContent('I’m RetiredMy last job was closest to'))
        fireEvent.click(screen.getAllByTestId('verify-pick-occupation')[0])
        expect(await screen.findByText('None in the last 5 years')).toBeInTheDocument()
        expect(screen.getByText('Lawyer')).toBeInTheDocument()
        expect(screen.queryByText('Student')).toBeNull()
    })

    it('an answer refused because the user already has today’s verification sends them Home', async () => {
        mockSave.mockResolvedValue({ kind: 'conflict', code: 'existing_verification' })
        await startFlow()
        await screen.findByTestId('verify-pick-annualSalary')
        fireEvent.click(continueButton())
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
    })

    // An EEA bank user whose approved ID names no nationality is asked it on the add-later screen.
    it('an approved user with a question still open goes to its feature’s add-later screen', async () => {
        mockStatus.mockResolvedValue('APPROVED')
        const questions = build({ money: true, tax: true }, 'nationality')
        questions.steps.push({
            id: 'nationality',
            features: ['bank'],
            answered: false,
            fields: [{ key: 'nationality', kind: 'country', required: true, value: 'DE' }],
        })
        mockQuestions.mockResolvedValue(questions)
        renderFlow()
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/verify?feature=bank'))
        expect(screen.queryByText('Your ID is confirmed!')).not.toBeInTheDocument()
    })

    it('a review that turns approved with a question open goes to the add-later screen', async () => {
        mockStatus.mockResolvedValue('IN_REVIEW')
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        renderFlow()
        expect(await screen.findByText('Checking your ID')).toBeInTheDocument()
        const opened = build({ money: true, tax: true }, 'nationality')
        opened.steps.push({
            id: 'nationality',
            features: ['bank'],
            answered: false,
            fields: [{ key: 'nationality', kind: 'country', required: true, value: 'DE' }],
        })
        mockQuestions.mockResolvedValue(opened)
        const { useWebSocket } = jest.requireMock('@/hooks/useWebSocket') as { useWebSocket: jest.Mock }
        const { onSumsubKycStatusUpdate } = useWebSocket.mock.calls.at(-1)[0]
        act(() => onSumsubKycStatusUpdate('APPROVED'))
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/verify?feature=bank'))
    })

    it('sends a user the server keeps on today’s flow back to Home', async () => {
        mockPlan.mockResolvedValue({ ...plan, flow: 'document-first' })
        renderFlow()
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
    })

    it('an approved user lands on the finished timeline, or on the proof-of-address suggestion', async () => {
        mockStatus.mockResolvedValue('APPROVED')
        // approved, so every question was answered before the ID check
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        const { unmount } = renderFlow()
        expect(await screen.findByText('Your ID is confirmed!')).toBeInTheDocument()
        expect(screen.getByTestId('verify-steps')).toHaveAttribute('data-phase', 'verified')
        expect(screen.queryByRole('listitem', { current: 'step' })).toBeNull()
        fireEvent.click(screen.getByTestId('verify-verified-payments'))
        expect(mockPush).toHaveBeenCalledWith('/profile/payments')
        unmount()

        mockPlan.mockResolvedValue({ ...plan, proofOfAddress: 'suggested', proofOfAddressReason: 'id_abroad' })
        renderFlow()
        expect(await screen.findByText('Add a proof of address')).toBeInTheDocument()
        expect(screen.getByText(/^Your ID isn’t from/)).toBeInTheDocument()
    })

    // A temporary protection sheet is the residence's own, so "your ID isn't from here" would be wrong.
    it('gives temporary protection as the reason when the approved ID was the sheet', async () => {
        mockStatus.mockResolvedValue('APPROVED')
        // approved, so every question was answered before the ID check
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        mockPlan.mockResolvedValue({
            ...plan,
            proofOfAddress: 'suggested',
            proofOfAddressReason: 'temporary_protection',
        })
        renderFlow()
        expect(await screen.findByText(/^With temporary protection, your bank account also needs/)).toBeInTheDocument()
        expect(screen.queryByText(/^Your ID isn’t from/)).toBeNull()
    })

    it('rule 1: Upload starts the existing supplement action, Skip goes on with no task left behind', async () => {
        mockStatus.mockResolvedValue('APPROVED')
        // approved, so every question was answered before the ID check
        mockQuestions.mockResolvedValue(build({ money: true, tax: true }, null))
        mockPlan.mockResolvedValue({ ...plan, proofOfAddress: 'suggested' })
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-poa-upload'))
        expect(mockStartAction).toHaveBeenCalledWith('supplement:bridge')
        fireEvent.click(screen.getByTestId('verify-poa-skip'))
        expect(skipProofOfAddress).toHaveBeenCalledTimes(1)
        expect(await screen.findByText('Your ID is confirmed!')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })
})
