/** @jest-environment jsdom */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import { SetupFlowProvider } from '@/features/setup/SetupFlowContext'
import EmailStep from '../Email'
import { reportEmailSaveFailure } from '@/features/setup/report-email-save-failure'

const mockUpdateUser = jest.fn()
const mockNext = jest.fn()
let mockEmail: string | null = ''
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUser(...args) }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('@/features/setup/report-email-save-failure', () => ({ reportEmailSaveFailure: jest.fn() }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'new-user', email: mockEmail } }, fetchUser: jest.fn(async () => {}) }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateUser.mockReset()
    mockEmail = ''
})

it('reports the email field edit once, each failed Continue with its reason, and never the address', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: 'This email is already associated with another account' })
    renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <SetupFlowProvider masterScreenIds={['notification-email']}>
                {onSignupScreen('notification-email', <EmailStep />)}
            </SetupFlowProvider>
        </QueryClientProvider>
    )
    const input = screen.getByRole('textbox', { name: 'Email address' })
    fireEvent.change(input, { target: { value: 'wrong' } })
    fireEvent.change(input, { target: { value: 'wrong2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.change(input, { target: { value: 'taken@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('The user with this email was already registered.')
    const capture = posthog.capture as jest.Mock
    expect(signupControls(capture)).toEqual([
        'email:change',
        'continue:tap',
        'email:error:invalid',
        'continue:tap',
        'email:error:already_registered',
    ])
    expect(capture.mock.calls[0][1]).toEqual(expect.objectContaining({ screen_id: 'notification-email' }))
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/example\.com|wrong/)
})

function renderEmail() {
    return renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <SetupFlowProvider masterScreenIds={['notification-email']}>
                {onSignupScreen('notification-email', <EmailStep />)}
            </SetupFlowProvider>
        </QueryClientProvider>
    )
}

it('continues with the current email without sending an update request', async () => {
    mockEmail = 'current@example.com'
    renderEmail()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: mockEmail } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockUpdateUser).not.toHaveBeenCalled()
})

it.each([
    { status: 401, code: 'STEP_UP_REQUIRED', error: 'STEP_UP_REQUIRED', failureKind: 'step_up_required' },
    { status: 400, error: 'Email changes require a verification code', failureKind: 'email_verification_required' },
    { status: 503, error: 'Email replacement is temporarily disabled', failureKind: 'email_replacement_disabled' },
    {
        status: 400,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        error: 'Reworded verification message',
        failureKind: 'email_verification_required',
    },
    {
        status: 503,
        code: 'EMAIL_CHANGE_UNAVAILABLE',
        error: 'Reworded unavailable message',
        failureKind: 'email_replacement_disabled',
    },
])(
    'offers explicit continuation with the existing address after protected replacement $status',
    async ({ failureKind, ...failure }) => {
        mockEmail = 'current@example.com'
        mockUpdateUser.mockResolvedValue(failure)
        renderEmail()
        fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
            target: { value: 'new@example.com' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(screen.getByText(/profile/i)).toBeInTheDocument())
        expect(reportEmailSaveFailure).toHaveBeenCalledWith(
            expect.objectContaining({ failureKind, status: failure.status, attempt: 1 })
        )
        expect(mockNext).not.toHaveBeenCalled()
        const continueActions = screen.getAllByRole('button', { name: /continue/i })
        fireEvent.click(continueActions[continueActions.length - 1])
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockUpdateUser).toHaveBeenCalledTimes(1)
    }
)

it.each([
    { status: 429, error: 'Too many requests' },
    { status: 500, error: 'Internal server error' },
    { status: 503, error: 'Service unavailable' },
])('retains retry for generic HTTP $status without advancing', async (failure) => {
    mockEmail = 'current@example.com'
    mockUpdateUser.mockResolvedValue(failure)
    renderEmail()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
    expect(mockNext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(2))
    expect(mockNext).not.toHaveBeenCalled()
})

it('keeps EMAIL_IN_USE as a duplicate-address error', async () => {
    mockUpdateUser.mockResolvedValue({
        status: 409,
        code: 'EMAIL_IN_USE',
        error: 'This email is already associated with another account',
    })
    renderEmail()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'taken@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('The user with this email was already registered.')).toBeInTheDocument()
    expect(mockNext).not.toHaveBeenCalled()
})

it.each(
    [null, '', '   '].flatMap((email) => [
        { email, status: 400, error: 'Email changes require a verification code' },
        { email, status: 503, error: 'Email replacement is temporarily disabled' },
    ])
)('does not offer absent email "$email" after protected replacement $status', async ({ email, status, error }) => {
    mockEmail = email
    mockUpdateUser.mockResolvedValue({ status, error })
    renderEmail()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'new@example.com' } })
    for (const attempt of [1, 2]) {
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(reportEmailSaveFailure).toHaveBeenCalledTimes(attempt))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
        expect(screen.getByText('We couldn’t save your email. Please try again.')).toBeInTheDocument()
        expect(screen.queryByText(/profile/i)).not.toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: /continue/i })).toHaveLength(1)
        expect(mockNext).not.toHaveBeenCalled()
    }
    expect(mockUpdateUser).toHaveBeenCalledTimes(2)
})
