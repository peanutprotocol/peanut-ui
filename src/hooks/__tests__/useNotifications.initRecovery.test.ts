// A failed OneSignal init used to stay failed (the adapter cached the rejection)
// while every remount re-reported it. Native transient failures now retry on
// the next online/foreground edge, a bounded number of times; permanent and
// web-SDK failures settle once and are reported once.

let mockUserId: string | null = 'user-1'
let mockIsNative = true
const mockAdapter = {
    init: jest.fn(),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue('default'),
    getPermission: jest.fn().mockResolvedValue('default'),
    isOptedIn: jest.fn().mockResolvedValue(false),
    onPermissionChange: jest.fn(() => () => {}),
    onSubscriptionChange: jest.fn(() => () => {}),
    onNotificationClick: jest.fn(() => () => {}),
    onNotificationReceived: jest.fn(() => () => {}),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: () => Promise.resolve(mockAdapter) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockIsNative }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: () => undefined, updateUserPreferences: jest.fn() }))
jest.mock('@/utils/migration.utils', () => ({ isPwaSunsetOn: () => false }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId } } : null }),
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

type Rtl = typeof import('@testing-library/react/pure')
let cleanup: (() => void) | undefined
beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => {
    cleanup?.()
    jest.restoreAllMocks()
})

// fresh module state per test; RTL is required alongside so both share one React
function load({ native = true }: { native?: boolean } = {}) {
    jest.resetModules()
    mockIsNative = native
    mockUserId = 'user-1'
    Object.values(mockAdapter).forEach((fn) => fn.mockClear())
    const rtl = require('@testing-library/react/pure') as Rtl
    cleanup = rtl.cleanup
    const { useNotifications } = require('../useNotifications') as typeof import('../useNotifications')
    const { captureException } = require('@sentry/nextjs') as { captureException: jest.Mock }
    const { OneSignalConfigError } =
        require('@/services/onesignal/errors') as typeof import('@/services/onesignal/errors')
    return { ...rtl, useNotifications, captureException, OneSignalConfigError }
}

const goOnline = () => window.dispatchEvent(new Event('online'))

describe('useNotifications init recovery', () => {
    it('recovers a transient native failure on the next online edge, linking and listening once', async () => {
        const { renderHook, act, waitFor, useNotifications, captureException } = load()
        mockAdapter.init.mockRejectedValueOnce(new Error('bridge unavailable')).mockResolvedValue(undefined)

        const view = renderHook(() => useNotifications())
        await waitFor(() => expect(mockAdapter.init).toHaveBeenCalledTimes(1))
        await act(async () => {})
        expect(view.result.current.oneSignalInitialized).toBe(false)

        await act(async () => goOnline())
        await waitFor(() => expect(view.result.current.oneSignalInitialized).toBe(true))
        await act(async () => goOnline())

        expect(mockAdapter.init).toHaveBeenCalledTimes(2)
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)
        expect(mockAdapter.login).toHaveBeenCalledWith('user-1')
        expect(mockAdapter.onPermissionChange).toHaveBeenCalledTimes(1)
        expect(mockAdapter.onSubscriptionChange).toHaveBeenCalledTimes(1)
        expect(mockAdapter.onNotificationClick).toHaveBeenCalledTimes(1)
        expect(captureException).not.toHaveBeenCalled()
    })

    it('links only the account that is current when init finally succeeds', async () => {
        const { renderHook, act, waitFor, useNotifications } = load()
        mockAdapter.init.mockRejectedValueOnce(new Error('bridge unavailable')).mockResolvedValue(undefined)

        const view = renderHook(() => useNotifications())
        await waitFor(() => expect(mockAdapter.init).toHaveBeenCalledTimes(1))
        mockUserId = 'user-2'
        view.rerender()

        await act(async () => goOnline())
        await waitFor(() => expect(view.result.current.oneSignalInitialized).toBe(true))
        await waitFor(() => expect(mockAdapter.login).toHaveBeenCalledTimes(1))
        expect(mockAdapter.login).toHaveBeenCalledWith('user-2')
    })

    it('reports a permanent failure once and never retries it, across remounts', async () => {
        const { renderHook, act, waitFor, useNotifications, captureException, OneSignalConfigError } = load()
        mockAdapter.init.mockRejectedValue(new OneSignalConfigError('OneSignal configuration missing: X is required'))

        const first = renderHook(() => useNotifications())
        await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1))
        first.unmount()
        renderHook(() => useNotifications())
        await act(async () => {
            goOnline()
            document.dispatchEvent(new Event('visibilitychange'))
        })

        expect(mockAdapter.init).toHaveBeenCalledTimes(1)
        expect(captureException).toHaveBeenCalledTimes(1)
    })

    it('stops after three attempts and reports the final failure once', async () => {
        const { renderHook, act, waitFor, useNotifications, captureException } = load()
        mockAdapter.init.mockRejectedValue(new Error('bridge unavailable'))

        renderHook(() => useNotifications())
        await waitFor(() => expect(mockAdapter.init).toHaveBeenCalledTimes(1))
        for (let i = 0; i < 4; i++) await act(async () => goOnline())

        expect(mockAdapter.init).toHaveBeenCalledTimes(3)
        expect(captureException).toHaveBeenCalledTimes(1)
        expect(captureException.mock.calls[0][1]).toMatchObject({ extra: { attempts: 3 } })
    })

    // The v16 web SDK latches "already initialized" before its config fetch, so
    // a second init in the same document can only fail.
    it('does not retry a web SDK failure', async () => {
        const { renderHook, act, waitFor, useNotifications, captureException } = load({ native: false })
        mockAdapter.init.mockRejectedValue(new Error('Timeout'))

        const first = renderHook(() => useNotifications())
        await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1))
        first.unmount()
        renderHook(() => useNotifications())
        await act(async () => goOnline())

        expect(mockAdapter.init).toHaveBeenCalledTimes(1)
        expect(captureException).toHaveBeenCalledTimes(1)
    })
})

export {}
