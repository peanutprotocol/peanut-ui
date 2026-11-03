import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { clearAuthToken, setAuthToken } from '@/utils/auth-token'
import { NotificationsView } from '../NotificationsView'

const mockAuthReady = jest.fn(async () => {})
jest.mock('@/utils/auth-token', () => ({
    ...jest.requireActual('@/utils/auth-token'),
    authReady: () => mockAuthReady(),
}))
jest.mock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: true }))

let mockProfileUserId: string | undefined
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => ({ user: mockProfileUserId ? { user: { userId: mockProfileUserId } } : null }),
}))
const mockGet = jest.fn()
const mockSave = jest.fn()
const mockToastError = jest.fn()
const mockPermission = jest.fn(async () => 'granted')
const mockAfterPermission = jest.fn(async () => {})
const mockOpenSettings = jest.fn(async () => true)
let mockDenied = false
let mockCanOpenSettings = true
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/services/notifications', () => ({
    ...jest.requireActual('@/services/notifications'),
    notificationsApi: {
        getPreferences: (...args: unknown[]) => mockGet(...args),
        savePreferences: (...args: unknown[]) => mockSave(...args),
    },
}))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        requestPermission: mockPermission,
        afterPermissionAttempt: mockAfterPermission,
        isPermissionDenied: mockDenied,
    }),
}))
jest.mock('@/utils/native-settings', () => ({
    canOpenAppSettings: () => mockCanOpenSettings,
    openAppSettings: () => mockOpenSettings(),
}))

const important = () => screen.getByRole('switch', { name: 'Important alerts' })
const offers = () => screen.getByRole('switch', { name: 'Offers and perks' })
const email = () => screen.getByRole('switch', { name: 'Email updates' })
let server = { push: true, email: true, marketingPush: false, emailUpdates: false, pushPermission: 'granted' }

beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
    mockProfileUserId = undefined
    mockAuthReady.mockReset().mockResolvedValue(undefined)
    setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-a' }))}.y`)
    mockGet.mockReset()
    mockSave.mockReset()
    mockDenied = false
    mockCanOpenSettings = true
    mockPermission.mockResolvedValue('granted')
    server = { push: true, email: true, marketingPush: false, emailUpdates: false, pushPermission: 'granted' }
    mockGet.mockImplementation(async () => server)
    mockSave.mockImplementation(async (changes: object) => (server = { ...server, ...changes }))
})

it('shows the saved choices and saves Email updates without asking the OS', async () => {
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(important()).toHaveAttribute('aria-checked', 'true'))
    expect(offers()).toHaveAttribute('aria-checked', 'false')
    expect(email()).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(email())
    expect(email()).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ emailUpdates: true }, 'user-a'))
    expect(mockPermission).not.toHaveBeenCalled()
})

it('turns Offers and perks on with Important off, asking the OS in the same tap', async () => {
    server.push = false
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(offers()).toBeEnabled())
    fireEvent.click(offers())
    expect(mockPermission).toHaveBeenCalledTimes(1)
    await waitFor(() =>
        expect(mockSave).toHaveBeenCalledWith({ marketingPush: true, pushPermission: 'granted' }, 'user-a')
    )
    expect(offers()).toHaveAttribute('aria-checked', 'true')
    expect(important()).toHaveAttribute('aria-checked', 'false')
})

it('saves a push switch off when the OS refuses, and records the answer', async () => {
    server.push = false
    mockPermission.mockResolvedValue('denied')
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(important()).toBeEnabled())
    fireEvent.click(important())
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ push: false, pushPermission: 'denied' }, 'user-a'))
    expect(important()).toHaveAttribute('aria-checked', 'false')
})

it('records a prompt closed without an answer as dismissed', async () => {
    server.push = false
    mockPermission.mockResolvedValue('default')
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(important()).toBeEnabled())
    fireEvent.click(important())
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ push: false, pushPermission: 'dismissed' }, 'user-a'))
})

it('turns Important off without asking the OS', async () => {
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(important()).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(important())
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ push: false }, 'user-a'))
    expect(mockPermission).not.toHaveBeenCalled()
})

it.each([true, false])('reads server choices after an uncertain save (committed=%s)', async (committed) => {
    mockSave.mockImplementationOnce(async (changes: object) => {
        if (committed) server = { ...server, ...changes }
        throw new Error('response lost')
    })
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(email()).toBeEnabled())
    fireEvent.click(email())
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(email()).toHaveAttribute('aria-checked', String(committed)))
    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(important()).toHaveAttribute('aria-checked', 'true')
    expect(offers()).toHaveAttribute('aria-checked', 'false')
})

it('contains an unsuccessful reconciliation GET without retrying the uncertain save', async () => {
    mockSave.mockRejectedValueOnce(new Error('response lost'))
    mockGet.mockResolvedValueOnce(server).mockRejectedValueOnce(new Error('offline'))
    const unhandled = jest.fn()
    window.addEventListener('unhandledrejection', unhandled)
    try {
        renderWithIntl(<NotificationsView />)
        await waitFor(() => expect(email()).toBeEnabled())
        fireEvent.click(email())
        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
        await act(async () => {})
        expect(mockToastError).toHaveBeenCalled()
        expect(mockSave).toHaveBeenCalledTimes(1)
        expect(unhandled).not.toHaveBeenCalled()
    } finally {
        window.removeEventListener('unhandledrejection', unhandled)
    }
})

it('explains blocked notifications and opens the OS settings where it can', async () => {
    mockDenied = true
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(important()).toBeEnabled())
    expect(screen.getByText('Notifications are off in your device settings.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(mockOpenSettings).toHaveBeenCalledTimes(1)
})

it('explains blocked notifications without a button where settings cannot open', async () => {
    mockDenied = true
    mockCanOpenSettings = false
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(important()).toBeEnabled())
    expect(screen.getByText('Notifications are off in your device settings.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open settings' })).not.toBeInTheDocument()
})

it('offers a retry when the settings cannot load', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))
    renderWithIntl(<NotificationsView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(important()).toHaveAttribute('aria-checked', 'true'))
    expect(mockGet).toHaveBeenCalledTimes(2)
})

describe('permission continuation ownership', () => {
    it.each(['changed', 'cleared', 'unmounted'] as const)(
        'does not save after the session is %s during permission',
        async (state) => {
            server.push = false
            let finish!: (permission: string) => void
            mockPermission.mockReturnValueOnce(
                new Promise((resolve) => {
                    finish = resolve
                })
            )
            const view = renderWithIntl(<NotificationsView />)
            await waitFor(() => expect(offers()).toBeEnabled())
            fireEvent.click(offers())
            expect(mockPermission).toHaveBeenCalledTimes(1)
            if (state === 'changed') setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-b' }))}.y`)
            if (state === 'cleared')
                await act(async () => {
                    await clearAuthToken()
                })
            if (state === 'unmounted') view.unmount()
            await act(async () => finish('granted'))
            expect(mockSave).not.toHaveBeenCalled()
        }
    )

    it('rechecks ownership after post-permission reconciliation too', async () => {
        server.push = false
        let finish!: () => void
        mockAfterPermission.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        renderWithIntl(<NotificationsView />)
        await waitFor(() => expect(offers()).toBeEnabled())
        fireEvent.click(offers())
        await waitFor(() => expect(mockAfterPermission).toHaveBeenCalledTimes(1))
        setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-b' }))}.y`)
        await act(async () => finish())
        expect(mockSave).not.toHaveBeenCalled()
    })

    it('uses the old-client save without unavailable feedback when hydration cannot read an identity', async () => {
        await clearAuthToken()
        renderWithIntl(<NotificationsView />)
        await waitFor(() => expect(email()).toBeEnabled())
        fireEvent.click(email())
        await act(async () => {})
        expect(mockSave).toHaveBeenCalledWith({ emailUpdates: true }, undefined)
        expect(mockToastError).not.toHaveBeenCalledWith('This check isn’t available right now.')
    })
})

it('R18 fixture permission precondition succeeds and logout cancels the continuation', async () => {
    await clearAuthToken()
    document.cookie = 'jwt-token=fixture; path=/'
    window.sessionStorage.setItem('peanut_fixture', 'home')
    let finish!: (permission: string) => void
    mockPermission.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        })
    )
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(offers()).toBeEnabled())
    fireEvent.click(offers())
    expect(mockPermission).toHaveBeenCalledTimes(1)
    await act(async () => {
        await clearAuthToken()
    })
    await act(async () => finish('granted'))
    expect(mockSave).not.toHaveBeenCalled()
})

it.each(['same', 'changed', 'cleared', 'unmounted'] as const)(
    'R18 waits for hydration before saving (%s)',
    async (state) => {
        await clearAuthToken()
        mockProfileUserId = 'user-a'
        let finish!: () => void
        mockAuthReady.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        const view = renderWithIntl(<NotificationsView />)
        await waitFor(() => expect(email()).toBeEnabled())
        fireEvent.click(email())
        expect(mockSave).not.toHaveBeenCalled()
        if (state === 'unmounted') view.unmount()
        if (state === 'cleared')
            await act(async () => {
                await clearAuthToken()
            })
        await act(async () => {
            if (state === 'same') setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-a' }))}.y`)
            if (state === 'changed') {
                setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-b' }))}.y`)
            }
            finish()
        })
        if (state === 'same') expect(mockSave).toHaveBeenCalledWith({ emailUpdates: true }, 'user-a')
        else expect(mockSave).not.toHaveBeenCalled()
    }
)

it('R18 fixture saves carry the actual fixture profile identity', async () => {
    document.cookie = 'jwt-token=fixture; path=/'
    window.sessionStorage.setItem('peanut_fixture', 'home')
    mockProfileUserId = 'fixture-user'
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(email()).toBeEnabled())
    fireEvent.click(email())
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ emailUpdates: true }, 'fixture-user'))
    expect(mockAuthReady).not.toHaveBeenCalled()
})

it('R18 a hydration failure shows unavailable feedback without saving', async () => {
    await clearAuthToken()
    mockAuthReady.mockRejectedValueOnce(new Error('storage unavailable'))
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(email()).toBeEnabled())
    fireEvent.click(email())
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('This check isn’t available right now.'))
    expect(mockSave).not.toHaveBeenCalled()
})

it('R18 duplicate taps while hydration is pending cannot start duplicate permissions or saves', async () => {
    await clearAuthToken()
    let finish!: () => void
    mockAuthReady.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        })
    )
    renderWithIntl(<NotificationsView />)
    await waitFor(() => expect(offers()).toBeEnabled())
    fireEvent.click(offers())
    fireEvent.click(offers())
    expect(mockPermission).not.toHaveBeenCalled()
    expect(mockSave).not.toHaveBeenCalled()
    await act(async () => {
        setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-a' }))}.y`)
        finish()
    })
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledTimes(1)
})
