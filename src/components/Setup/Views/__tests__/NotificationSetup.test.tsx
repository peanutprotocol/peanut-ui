import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { USER } from '@/constants/query.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupFlowProvider } from '@/features/setup/SetupFlowContext'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import EmailStep from '../Email'
import NotificationsStep from '../Notifications'

const mockNext = jest.fn()
const mockSave = jest.fn()
const mockUpdateUser = jest.fn()
const mockFetchUser = jest.fn(async () => {})
const mockPermission = jest.fn(async () => 'denied')
const mockAfterPermission = jest.fn(async () => {})
let mockReady = true
let mockUser: { user: { userId: string; email: string } } | null
let queryClient: QueryClient
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUser(...args) }))
jest.mock('@/services/notifications', () => ({
    ...jest.requireActual('@/services/notifications'),
    notificationsApi: { savePreferences: (...args: unknown[]) => mockSave(...args) },
}))
const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
let mockVariant: 'control' | 'switches' = 'switches'
jest.mock('@/features/setup/notificationsExperiment', () => ({
    ...jest.requireActual('@/features/setup/notificationsExperiment'),
    readNotificationsVariant: () => mockVariant,
}))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        requestPermission: mockPermission,
        afterPermissionAttempt: mockAfterPermission,
        oneSignalInitialized: mockReady,
    }),
}))
const mockCaptureException = jest.fn()
const mockCaptureMessage = jest.fn()
const mockAddBreadcrumb = jest.fn()
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
    addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }),
}))
// Registry imports server-only content and other screens; only its order matters here.
jest.mock('@/components/Setup/Setup.consts', () => ({
    setupScreenIds: ['notification-email', 'notification-permission'],
}))

const renderStep = (view: React.ReactNode) =>
    renderWithIntl(
        <QueryClientProvider client={queryClient}>
            <SetupFlowProvider masterScreenIds={setupScreenIds}>{view}</SetupFlowProvider>
        </QueryClientProvider>
    )
beforeEach(() => {
    mockVariant = 'switches'
    jest.clearAllMocks()
    mockNext.mockReset()
    mockReady = true
    mockUser = { user: { userId: 'new-user', email: '' } }
    queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    mockSave.mockResolvedValue(undefined)
    mockUpdateUser.mockResolvedValue({})
})

it('requires and saves a valid trimmed email before advancing', async () => {
    renderStep(<EmailStep />)
    const input = screen.getByRole('textbox', { name: 'Email address' })
    fireEvent.change(input, { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(mockUpdateUser).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '  money@example.com  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockUpdateUser).toHaveBeenCalledWith({ userId: 'new-user', email: 'money@example.com' })
})
it('restores the entered email after Next and Back remount the step', async () => {
    const RoundTrip = () => {
        const [next, setNext] = useState(false)
        mockNext.mockImplementation(() => setNext(true))
        return next ? <button onClick={() => setNext(false)}>Back</button> : <EmailStep />
    }
    renderStep(<RoundTrip />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  money@example.com  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveValue('money@example.com')
})
it('updates the shared profile email after acknowledgement even if refreshing the profile fails', async () => {
    queryClient.setQueryData([USER], mockUser)
    mockFetchUser.mockRejectedValueOnce(new Error('refresh unavailable'))
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(queryClient.getQueryData([USER])).toEqual({ user: { userId: 'new-user', email: 'money@example.com' } })
})
it('keeps the entered email on a failed save and only advances after a successful retry', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: 'failed' })
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('We couldn’t save your email. Please try again.')
    expect(screen.queryByRole('link', { name: 'How to recover your account' })).not.toBeInTheDocument()
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockFetchUser).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('money@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockUpdateUser).toHaveBeenCalledTimes(2)
})
it('explains an already registered email, links to recovery, and clears the notice when edited', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: 'This email is already associated with another account' })
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'existing@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('The user with this email was already registered.')
    expect(screen.getByRole('link', { name: 'How to recover your account' })).toHaveAttribute(
        'href',
        '/en/help/account-recovery'
    )
    const recoveryLink = screen.getByRole('link', { name: 'How to recover your account' })
    expect(recoveryLink.closest('[data-setup-footer]')).toContainElement(
        screen.getByRole('button', { name: 'Continue' })
    )
    // hints sit above the CTA so the CTA pins to the bottom of the panel
    expect(
        screen.getByRole('button', { name: 'Continue' }).compareDocumentPosition(recoveryLink) &
            Node.DOCUMENT_POSITION_PRECEDING
    ).toBeTruthy()
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockFetchUser).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('existing@example.com')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new@example.com' } })
    expect(screen.queryByText('The user with this email was already registered.')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'How to recover your account' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
it('keeps the email step retryable after a rejected request', async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error('network'))
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('We couldn’t save your email. Please try again.')
    expect(mockNext).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
})
it.each([
    ['network', { error: 'Something went wrong. Please try again.', failureKind: 'network' }, undefined],
    ['http', { error: 'Internal error', failureKind: 'http', status: 500 }, '500'],
    ['other', undefined, undefined],
])(
    'never advances on a %s save failure and reports it to Sentry without the email',
    async (kind, result, httpStatus) => {
        if (result) mockUpdateUser.mockResolvedValueOnce(result)
        else mockUpdateUser.mockRejectedValueOnce(new Error('boom'))
        renderStep(<EmailStep />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await screen.findByText('We couldn’t save your email. Please try again.')
        await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
        expect(mockNext).not.toHaveBeenCalled()
        expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
        const [message, context] = mockCaptureMessage.mock.calls[0]
        expect(message).toBe('Sign-up email save failed')
        expect(context).toMatchObject({
            level: 'error',
            fingerprint: ['signup-email-save-failed', kind],
            tags: {
                flow: 'signup',
                step: 'notification-email',
                failure_kind: kind,
                native: 'false',
                platform: expect.any(String),
                attempt: '1',
            },
        })
        expect(context.tags.http_status).toBe(httpStatus)
        expect(JSON.stringify(mockCaptureMessage.mock.calls)).not.toContain('money@example.com')

        // a second press retries the save and counts as attempt 2; still no advance
        mockUpdateUser.mockResolvedValueOnce({ error: 'Internal error', failureKind: 'http', status: 503 })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(mockCaptureMessage).toHaveBeenCalledTimes(2))
        expect(mockCaptureMessage.mock.calls[1][1].tags.attempt).toBe('2')
        expect(mockNext).not.toHaveBeenCalled()
    }
)
it('does not report an already registered email as an error', async () => {
    mockUpdateUser.mockResolvedValueOnce({
        error: 'This email is already associated with another account',
        failureKind: 'http',
        status: 409,
    })
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'existing@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('The user with this email was already registered.')
    expect(mockCaptureMessage).not.toHaveBeenCalled()
    expect(mockAddBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ category: 'signup' }))
    expect(mockNext).not.toHaveBeenCalled()
})
it('advances without saving when the email is already saved and unchanged', async () => {
    mockUser = { user: { userId: 'new-user', email: 'money@example.com' } }
    renderStep(<EmailStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockUpdateUser).not.toHaveBeenCalled()
})
it('reports a navigation failure after a confirmed save instead of showing a failed save', async () => {
    const navigationError = new Error('stepper failed')
    mockNext.mockRejectedValueOnce(navigationError)
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockCaptureException).toHaveBeenCalledWith(navigationError))
    expect(screen.queryByText('We couldn’t save your email. Please try again.')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
})
it('says below Continue that account emails come always and news and offers can be turned off', () => {
    renderStep(<EmailStep />)
    const note = screen.getByText('We’ll email you about your account. You can turn off news and offers anytime.')
    expect(
        screen.getByRole('button', { name: 'Continue' }).compareDocumentPosition(note) &
            Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // the old subtitle promised an opt-out from all email, which account email does not allow
    expect(screen.queryByText(/opt out/i)).not.toBeInTheDocument()
})
it('does not leave the email step before the authenticated user is available', async () => {
    mockUser = null
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Your account is still loading. Try again in a moment.')
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockNext).not.toHaveBeenCalled()
})
it('shows the email field with its label and the "Email" placeholder', () => {
    renderStep(<EmailStep />)
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAttribute('placeholder', 'Email')
})
it('waits for the email save acknowledgement before advancing', async () => {
    let resolveSave!: (result: object) => void
    mockUpdateUser.mockReturnValueOnce(
        new Promise((resolve) => {
            resolveSave = resolve
        })
    )
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await act(async () => {})
    expect(mockNext).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Continue$/ })).toBeDisabled()
    await act(async () => {
        resolveSave({})
    })
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
const important = () => screen.getByRole('switch', { name: 'Important alerts' })
const offers = () => screen.getByRole('switch', { name: 'Offers and perks' })
const emailUpdates = () => screen.getByRole('switch', { name: 'Email updates' })
const continueButton = () => screen.getByRole('button', { name: 'Continue' })
const notNow = () => screen.getByRole('button', { name: 'Not now' })
const states = () => [important(), offers(), emailUpdates()].map((s) => s.getAttribute('aria-checked'))

it('starts with every switch off, Continue disabled until one is on, and Not now under it', () => {
    renderStep(<NotificationsStep />)
    expect(states()).toEqual(['false', 'false', 'false'])
    expect(continueButton()).toBeDisabled()
    expect(continueButton().compareDocumentPosition(notNow()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const note = screen.getByText('You can change any of these anytime in your profile.')
    expect(emailUpdates().compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(note.compareDocumentPosition(continueButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(emailUpdates())
    expect(continueButton()).toBeEnabled()
})
it('turns Email updates on with the first Important alerts, never Offers and perks', () => {
    renderStep(<NotificationsStep />)
    fireEvent.click(important())
    expect(states()).toEqual(['true', 'false', 'true'])
})
it('cascades only once: afterwards each switch works on its own', () => {
    renderStep(<NotificationsStep />)
    fireEvent.click(important())
    fireEvent.click(emailUpdates())
    fireEvent.click(important())
    fireEvent.click(important())
    expect(states()).toEqual(['true', 'false', 'false'])
    fireEvent.click(offers())
    expect(states()).toEqual(['true', 'true', 'false'])
})
it('asks the OS inside the Continue tap and saves every choice with the grant', async () => {
    mockPermission.mockResolvedValueOnce('granted')
    renderStep(<NotificationsStep />)
    fireEvent.click(important())
    fireEvent.click(offers())
    fireEvent.click(continueButton())
    // synchronously inside the click: the browser only accepts a prompt from a user gesture
    expect(mockPermission).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockAfterPermission).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledWith({
        push: true,
        marketingPush: true,
        emailUpdates: true,
        pushPermission: 'granted',
    })
    expect(mockCapture).toHaveBeenCalledWith('signup_push_permission_answered', {
        variant: 'switches',
        answer: 'granted',
    })
    expect(mockCapture).toHaveBeenCalledWith('notification_choices_saved', {
        outcome: 'granted',
        important: true,
        offers: true,
        email: true,
    })
})
it('asks the OS for Offers and perks alone too', async () => {
    mockPermission.mockResolvedValueOnce('granted')
    renderStep(<NotificationsStep />)
    fireEvent.click(offers())
    fireEvent.click(continueButton())
    expect(mockPermission).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledWith({
        push: false,
        marketingPush: true,
        emailUpdates: false,
        pushPermission: 'granted',
    })
})
it.each([
    ['denied', 'denied'],
    ['default', 'dismissed'],
])('saves both push switches off when the OS answers %s, and keeps Email updates', async (answer, recorded) => {
    mockPermission.mockResolvedValueOnce(answer)
    renderStep(<NotificationsStep />)
    fireEvent.click(important())
    fireEvent.click(offers())
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledWith({
        push: false,
        marketingPush: false,
        emailUpdates: true,
        pushPermission: recorded,
    })
    expect(states()).toEqual(['false', 'false', 'true'])
})
it('records a push SDK failure as a dismissed prompt', async () => {
    mockPermission.mockRejectedValueOnce(new Error('SDK unavailable'))
    renderStep(<NotificationsStep />)
    fireEvent.click(important())
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledWith({
        push: false,
        marketingPush: false,
        emailUpdates: true,
        pushPermission: 'dismissed',
    })
})
it('saves Email updates alone without asking the OS', async () => {
    renderStep(<NotificationsStep />)
    fireEvent.click(emailUpdates())
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockPermission).not.toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith({ push: false, marketingPush: false, emailUpdates: true })
    expect(mockCapture).toHaveBeenCalledWith(
        'notification_choices_saved',
        expect.objectContaining({ outcome: 'not_asked' })
    )
})
it('Not now saves everything off without asking the OS, whatever was switched on', async () => {
    renderStep(<NotificationsStep />)
    fireEvent.click(important())
    fireEvent.click(offers())
    fireEvent.click(notNow())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockPermission).not.toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith({ push: false, marketingPush: false, emailUpdates: false })
    expect(mockCapture).toHaveBeenCalledWith(
        'notification_choices_saved',
        expect.objectContaining({ outcome: 'skipped' })
    )
})
it('blocks on a failed save and retries without asking the OS again', async () => {
    mockPermission.mockResolvedValueOnce('granted')
    mockSave.mockRejectedValueOnce(new Error('network'))
    renderStep(<NotificationsStep />)
    fireEvent.click(important())
    fireEvent.click(continueButton())
    await screen.findByText('We couldn’t save your settings. Please try again.')
    expect(mockNext).not.toHaveBeenCalled()
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledTimes(2)
    expect(mockSave).toHaveBeenLastCalledWith({
        push: true,
        marketingPush: false,
        emailUpdates: true,
        pushPermission: 'granted',
    })
})
it('keeps an Offers-only choice retryable when the OS says no and the save fails', async () => {
    mockPermission.mockResolvedValueOnce('denied')
    mockSave.mockRejectedValueOnce(new Error('network'))
    renderStep(<NotificationsStep />)
    fireEvent.click(offers())
    fireEvent.click(continueButton())
    await screen.findByText('We couldn’t save your settings. Please try again.')
    expect(states()).toEqual(['false', 'true', 'false'])
    expect(continueButton()).toBeEnabled()
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenLastCalledWith({
        push: false,
        marketingPush: false,
        emailUpdates: false,
        pushPermission: 'denied',
    })
})
it('waits for the preferences write before advancing', async () => {
    let resolveSave!: () => void
    mockSave.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            resolveSave = resolve
        })
    )
    renderStep(<NotificationsStep />)
    fireEvent.click(emailUpdates())
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
    expect(mockNext).not.toHaveBeenCalled()
    await act(async () => resolveSave())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})

it('shows the three-switch heading balanced, without a subtitle', () => {
    renderStep(<NotificationsStep />)
    const title = screen.getByRole('heading', { name: 'Enable notifications to stay in the loop' })
    expect(title).toHaveClass('text-balance')
    expect(screen.queryByText(/Know instantly when money arrives/)).not.toBeInTheDocument()
})
it('records the OS refusal as the experiment answer, once per prompt', async () => {
    mockPermission.mockResolvedValueOnce('denied')
    renderStep(<NotificationsStep />)
    fireEvent.click(important())
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    const answers = mockCapture.mock.calls.filter(([event]) => event === 'signup_push_permission_answered')
    expect(answers).toEqual([['signup_push_permission_answered', { variant: 'switches', answer: 'denied' }]])
})
it('sends no experiment answer when no prompt opened', async () => {
    renderStep(<NotificationsStep />)
    fireEvent.click(notNow())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockCapture).not.toHaveBeenCalledWith('signup_push_permission_answered', expect.anything())
})

describe('control: the single push switch', () => {
    const pushToggle = () => screen.getByRole('switch', { name: 'Push notifications' })
    beforeEach(() => {
        mockVariant = 'control'
    })

    it('shows the old heading and one switch, off', () => {
        renderStep(<NotificationsStep />)
        expect(screen.getByRole('heading', { name: 'Turn on notifications' })).toBeInTheDocument()
        expect(
            screen.getByText(
                'Know instantly when money arrives, a payment goes through, or your account requires attention.'
            )
        ).toBeInTheDocument()
        expect(screen.getAllByRole('switch')).toHaveLength(1)
        expect(pushToggle()).toHaveAttribute('aria-checked', 'false')
        expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument()
    })
    it('asks the OS inside the switch tap, records the answer, and saves the grant on Continue', async () => {
        mockPermission.mockResolvedValueOnce('granted')
        renderStep(<NotificationsStep />)
        fireEvent.click(pushToggle())
        expect(mockPermission).toHaveBeenCalledTimes(1)
        await waitFor(() =>
            expect(mockCapture).toHaveBeenCalledWith('signup_push_permission_answered', {
                variant: 'control',
                answer: 'granted',
            })
        )
        expect(pushToggle()).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).toHaveBeenCalledWith({ push: true, pushPermission: 'granted' })
    })
    it.each([
        ['denied', 'denied'],
        ['default', 'dismissed'],
    ])('turns the switch back off when the OS answers %s and saves nothing', async (answer, recorded) => {
        mockPermission.mockResolvedValueOnce(answer)
        renderStep(<NotificationsStep />)
        fireEvent.click(pushToggle())
        await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-checked', 'false'))
        expect(mockCapture).toHaveBeenCalledWith('signup_push_permission_answered', {
            variant: 'control',
            answer: recorded,
        })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).not.toHaveBeenCalled()
    })
    it('continues without asking or saving when the switch is never touched', async () => {
        renderStep(<NotificationsStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockPermission).not.toHaveBeenCalled()
        expect(mockSave).not.toHaveBeenCalled()
    })
    it('saves an opt-out after on and off, blocks on a failed save, and retries', async () => {
        mockPermission.mockResolvedValueOnce('granted')
        mockSave.mockRejectedValueOnce(new Error('network'))
        renderStep(<NotificationsStep />)
        fireEvent.click(pushToggle())
        await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-checked', 'true'))
        fireEvent.click(pushToggle())
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await screen.findByText('We couldn’t save your settings. Please try again.')
        expect(mockNext).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).toHaveBeenLastCalledWith({ push: false })
    })
})
