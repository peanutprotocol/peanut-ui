import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { NotificationsView } from '../NotificationsView'

const mockGet = jest.fn()
const mockSave = jest.fn()
const mockToastError = jest.fn()
const mockPermission = jest.fn(async () => 'granted')
const mockAfterPermission = jest.fn(async () => {})
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/services/notifications', () => ({
    notificationsApi: {
        getPreferences: (...args: unknown[]) => mockGet(...args),
        savePreferences: (...args: unknown[]) => mockSave(...args),
    },
}))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({ requestPermission: mockPermission, afterPermissionAttempt: mockAfterPermission }),
}))

const push = () => screen.getByRole('switch', { name: 'Push notifications' })
const marketing = () => screen.getByRole('switch', { name: 'News and offers' })
let server = { push: true, email: true, marketingPush: false }

beforeEach(() => {
    jest.clearAllMocks()
    server = { push: true, email: true, marketingPush: false }
    mockGet.mockImplementation(async () => server)
    mockSave.mockImplementation(async (changes: object) => (server = { ...server, ...changes }))
})

it('shows the saved choices and saves a news and offers opt-in on its own', async () => {
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(push()).toHaveAttribute('aria-checked', 'true'))
    expect(marketing()).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(marketing())
    expect(marketing()).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ marketingPush: true }))
    expect(mockPermission).not.toHaveBeenCalled()
})

it('puts a choice back and says so when the save fails', async () => {
    mockSave.mockRejectedValueOnce(new Error('network'))
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(marketing()).toBeEnabled())
    fireEvent.click(marketing())
    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
    expect(marketing()).toHaveAttribute('aria-checked', 'false')
})

it('turning push off locks news and offers, and turning it on asks the OS in the same tap', async () => {
    server.marketingPush = true
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(marketing()).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(push())
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ push: false }))
    expect(marketing()).toHaveAttribute('aria-checked', 'false')
    expect(marketing()).toBeDisabled()
    fireEvent.click(push())
    expect(mockPermission).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockSave).toHaveBeenLastCalledWith({ push: true }))
    expect(marketing()).toHaveAttribute('aria-checked', 'true')
})

it('offers a retry when the settings cannot load', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))
    renderWithIntl(<NotificationsView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(push()).toHaveAttribute('aria-checked', 'true'))
    expect(mockGet).toHaveBeenCalledTimes(2)
})
