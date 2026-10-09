let mockEnvironment = 'preview'
const mockInit = jest.fn()
const mockAdapter = {
    init: mockInit,
    requestPermission: jest.fn(async () => 'granted'),
    getPermission: async () => 'default',
    isOptedIn: async () => false,
    onPermissionChange: jest.fn(),
    onSubscriptionChange: jest.fn(),
    onNotificationClick: jest.fn(),
    onNotificationReceived: jest.fn(),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: async () => mockAdapter }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/sentry-env', () => ({ inferSentryEnvironment: () => mockEnvironment }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: jest.fn(), updateUserPreferences: jest.fn() }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

type Rtl = typeof import('@testing-library/react/pure')
let cleanup: (() => void) | undefined
afterEach(() => {
    cleanup?.()
    jest.restoreAllMocks()
})

async function initFailingWith(message: string) {
    // Each case is a fresh page. A permanent refusal intentionally settles
    // initialization for the document, so tests must not share that singleton.
    jest.resetModules()
    mockInit.mockReset().mockRejectedValue(new Error(message))
    const { renderHook, act, cleanup: clean } = require('@testing-library/react/pure') as Rtl
    cleanup = clean
    const { useNotifications } = require('../useNotifications') as typeof import('../useNotifications')
    const { captureException } = require('@sentry/nextjs') as { captureException: jest.Mock }
    const view = renderHook(() => useNotifications())
    await act(async () => {
        await view.result.current.requestPermission().catch(() => {})
    })
    return captureException
}

describe('OneSignal origin refusal', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('is not reported from a preview deploy, which OneSignal refuses by design', async () => {
        mockEnvironment = 'preview'
        const captureException = await initFailingWith('Can only be used on: https://staging.peanut.me')
        expect(captureException).not.toHaveBeenCalled()
    })

    it('is reported on production, where it means push is misconfigured', async () => {
        mockEnvironment = 'production'
        const captureException = await initFailingWith('Can only be used on: https://peanut.me')
        expect(captureException).toHaveBeenCalledTimes(1)
    })

    it('still reports any other init failure from a preview deploy', async () => {
        mockEnvironment = 'preview'
        const captureException = await initFailingWith('OneSignal script blocked')
        expect(captureException).toHaveBeenCalledTimes(1)
    })
})
