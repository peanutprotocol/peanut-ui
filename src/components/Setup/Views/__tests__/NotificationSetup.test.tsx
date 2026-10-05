import { fireEvent, screen, waitFor } from '@testing-library/react'
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
    useAuth: () => ({ user: { user: { userId: 'new-user', email: '' } }, fetchUser: mockFetchUser }),
}))
// Registry imports server-only content and other screens; only its order matters here.
jest.mock('@/components/Setup/Setup.consts', () => ({
    setupScreenIds: ['notification-email', 'notification-permission'],
}))

const renderStep = (view: React.ReactNode) =>
    renderWithIntl(<SetupFlowProvider masterScreenIds={setupScreenIds}>{view}</SetupFlowProvider>)
beforeEach(() => {
    jest.clearAllMocks()
    mockReady = true
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
it('keeps the entered email and advances silently if saving fails', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: 'failed' })
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('We couldn’t save your email. Please try again.')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('money@example.com')
})
it('defaults both channels on and continues after OS denial', async () => {
    renderStep(<NotificationsStep />)
    screen.getAllByRole('switch').forEach((toggle) => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledWith({ push: true, email: true })
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(mockAfterPermission).toHaveBeenCalledTimes(1)
})
it('saves both off without opening the system prompt', async () => {
    renderStep(<NotificationsStep />)
    screen.getAllByRole('switch').forEach((toggle) => fireEvent.click(toggle))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledWith({ push: false, email: false })
    expect(mockPermission).not.toHaveBeenCalled()
})
it('continues and requests enabled push silently after a settings save failure', async () => {
    mockSave.mockRejectedValueOnce(new Error('network'))
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('We couldn’t save your settings. Please try again.')).not.toBeInTheDocument()
})
it('continues while the preferences backend never responds', async () => {
    mockSave.mockReturnValueOnce(new Promise(() => {}))
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
it('requests enabled push even while the SDK is initializing', async () => {
    mockReady = false
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/aren’t ready yet/)).not.toBeInTheDocument()
})
it('continues silently if the push SDK rejects its permission request', async () => {
    mockPermission.mockRejectedValueOnce(new Error('SDK unavailable'))
    renderStep(<NotificationsStep />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
it('keeps email validation local even if the backend never responds', async () => {
    mockUpdateUser.mockReturnValueOnce(new Promise(() => {}))
    renderStep(<EmailStep />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'money@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
})
