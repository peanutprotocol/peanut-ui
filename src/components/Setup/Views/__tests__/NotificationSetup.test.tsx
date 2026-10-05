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
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockFetchUser).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('money@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockUpdateUser).toHaveBeenCalledTimes(2)
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
it('does not leave the email step before the authenticated user is available', async () => {
    mockUser = null
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Your account is still loading. Try again in a moment.')
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockNext).not.toHaveBeenCalled()
})
it('defaults both channels on and continues after OS denial', async () => {
    renderStep(<NotificationsStep />)
    screen.getAllByRole('switch').forEach((toggle) => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledWith({ push: true, email: true })
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(mockAfterPermission).toHaveBeenCalledTimes(1)
})
it('saves both off without opening the system prompt', async () => {
    renderStep(<NotificationsStep />)
    screen.getAllByRole('switch').forEach((toggle) => fireEvent.click(toggle))
    fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledWith({ push: false, email: false })
    expect(mockPermission).not.toHaveBeenCalled()
})
it.each(['push', 'email'])(
    'does not advance after a failed %s opt-out, and retries the same choice',
    async (channel) => {
        mockSave.mockRejectedValueOnce(new Error('network'))
        renderStep(<NotificationsStep />)
        fireEvent.click(
            screen.getByRole('switch', {
                name: channel === 'push' ? 'App push notifications' : 'Email notifications',
            })
        )
        fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
        await screen.findByText('We couldn’t save your settings. Please try again.')
        expect(mockNext).not.toHaveBeenCalled()
        expect(mockSave).toHaveBeenCalledWith({ push: channel !== 'push', email: channel !== 'email' })
        fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).toHaveBeenCalledTimes(2)
    }
)
it('requests push within the click gesture while waiting for an email opt-out acknowledgement', async () => {
    let resolveSave!: () => void
    mockSave.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            resolveSave = resolve
        })
    )
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('switch', { name: 'Email notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
    expect(mockPermission).toHaveBeenCalledTimes(1)
    await act(async () => {})
    expect(mockNext).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Sounds good$/ })).toBeDisabled()
    await act(async () => {
        resolveSave()
    })
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
it('continues and requests enabled push silently after a settings save failure', async () => {
    mockSave.mockRejectedValueOnce(new Error('network'))
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('We couldn’t save your settings. Please try again.')).not.toBeInTheDocument()
})
it('continues while the preferences backend never responds', async () => {
    mockSave.mockReturnValueOnce(new Promise(() => {}))
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
it('requests enabled push even while the SDK is initializing', async () => {
    mockReady = false
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/aren’t ready yet/)).not.toBeInTheDocument()
})
it('continues silently if the push SDK rejects its permission request', async () => {
    mockPermission.mockRejectedValueOnce(new Error('SDK unavailable'))
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Sounds good' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
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
