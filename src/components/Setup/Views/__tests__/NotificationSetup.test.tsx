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
    notificationsApi: { savePreferences: (...args: unknown[]) => mockSave(...args) },
}))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        requestPermission: mockPermission,
        afterPermissionAttempt: mockAfterPermission,
        oneSignalInitialized: mockReady,
    }),
}))
const mockCaptureException = jest.fn()
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
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
it('says once, below Continue, that we email about the account and the user can opt out', () => {
    renderStep(<EmailStep />)
    const note = screen.getByText('We’ll email you about your account. You can opt out anytime.')
    expect(
        screen.getByRole('button', { name: 'Continue' }).compareDocumentPosition(note) &
            Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.getAllByText(/opt out/i)).toHaveLength(1)
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
const pushToggle = () => screen.getByRole('switch', { name: 'Push notifications' })
it('offers push only, off by default, and an untouched Continue saves nothing', async () => {
    renderStep(<NotificationsStep />)
    expect(screen.getAllByRole('switch')).toHaveLength(1)
    expect(screen.queryByText(/Email notifications/)).not.toBeInTheDocument()
    expect(pushToggle()).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).not.toHaveBeenCalled()
    expect(mockPermission).not.toHaveBeenCalled()
})
it('asks the OS for permission in the same tap that turns push on, and keeps it on when granted', async () => {
    mockPermission.mockResolvedValueOnce('granted')
    renderStep(<NotificationsStep />)
    fireEvent.click(pushToggle())
    // synchronously inside the click: the browser only accepts a prompt from a user gesture
    expect(mockPermission).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockAfterPermission).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(pushToggle()).not.toBeDisabled())
    expect(pushToggle()).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledWith({ push: true, email: true })
})
it.each(['denied', 'default'])(
    'turns push back off when the OS answers %s, without an opt-out save',
    async (answer) => {
        mockPermission.mockResolvedValueOnce(answer)
        renderStep(<NotificationsStep />)
        fireEvent.click(pushToggle())
        await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-checked', 'false'))
        await waitFor(() => expect(pushToggle()).not.toBeDisabled())
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).not.toHaveBeenCalled()
    }
)
it('turns push back off when the push SDK rejects the permission request', async () => {
    mockPermission.mockRejectedValueOnce(new Error('SDK unavailable'))
    renderStep(<NotificationsStep />)
    fireEvent.click(pushToggle())
    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-checked', 'false'))
    await waitFor(() => expect(pushToggle()).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
it('saves an explicit opt-out, blocks on a failed save, and retries the same choice', async () => {
    mockPermission.mockResolvedValueOnce('granted')
    mockSave.mockRejectedValueOnce(new Error('network'))
    renderStep(<NotificationsStep />)
    fireEvent.click(pushToggle())
    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-checked', 'true'))
    await waitFor(() => expect(pushToggle()).not.toBeDisabled())
    fireEvent.click(pushToggle())
    expect(pushToggle()).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('We couldn’t save your settings. Please try again.')
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith({ push: false, email: true })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledTimes(2)
})
it('waits for the push opt-in write, so a later opt-out on this step cannot be overwritten by it', async () => {
    mockPermission.mockResolvedValueOnce('granted')
    let resolveSave!: () => void
    mockSave.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            resolveSave = resolve
        })
    )
    renderStep(<NotificationsStep />)
    fireEvent.click(pushToggle())
    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-checked', 'true'))
    await waitFor(() => expect(pushToggle()).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await act(async () => {})
    expect(mockSave).toHaveBeenCalledWith({ push: true, email: true })
    expect(mockNext).not.toHaveBeenCalled()
    await act(async () => resolveSave())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
it('advances past a failed best-effort save when push is on', async () => {
    mockPermission.mockResolvedValueOnce('granted')
    mockSave.mockRejectedValueOnce(new Error('network'))
    renderStep(<NotificationsStep />)
    fireEvent.click(pushToggle())
    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-checked', 'true'))
    await waitFor(() => expect(pushToggle()).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('We couldn’t save your settings. Please try again.')).not.toBeInTheDocument()
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
