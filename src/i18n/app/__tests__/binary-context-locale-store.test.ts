jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

const mockGetInfo = jest.fn()
const mockRegister = jest.fn()
const mockFlags = jest.fn()
const mockPlatform = jest.fn()
const mockFetch = jest.fn().mockResolvedValue({ ok: true })
jest.mock('@/utils/sentry.utils', () => ({ fetchWithSentry: (...args: unknown[]) => mockFetch(...args) }))
jest.mock('@/utils/auth-token', () => ({
    authReady: async () => {},
    getAuthToken: () => 'token',
    getAuthHeaders: (extra: object) => ({ Authorization: 'Bearer token', ...extra }),
}))
jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.test.com' }))
jest.mock('@capacitor/app', () => ({ App: { getInfo: () => mockGetInfo() } }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockPlatform() !== 'web',
    isNativeBridge: () => mockPlatform() !== 'web',
    getPlatform: () => mockPlatform(),
}))
jest.mock('@capacitor/device', () => ({ Device: { getLanguageTag: async () => ({ value: 'en-US' }) } }))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        register: (...args: unknown[]) => mockRegister(...args),
        setPersonPropertiesForFlags: (...args: unknown[]) => mockFlags(...args),
        setPersonProperties: jest.fn(),
        reloadFeatureFlags: jest.fn(),
        // api-fetch reports slow requests by wall-clock time, so a loaded machine can hit it
        capture: jest.fn(),
        _isIdentified: () => false,
    },
}))

function freshModules() {
    let store!: typeof import('../locale-store')
    let version!: typeof import('@/utils/app-version')
    let setup!: typeof import('@/utils/posthog-setup')
    let api!: typeof import('@/utils/api-fetch')
    jest.isolateModules(() => {
        store = require('../locale-store')
        version = require('@/utils/app-version')
        setup = require('@/utils/posthog-setup')
        api = require('@/utils/api-fetch')
    })
    return { store, version, setup, api }
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockPlatform.mockReturnValue('android-native')
})
afterEach(() => jest.useRealTimers())

describe('binary context shared across consumers', () => {
    it('uses one native read for simultaneous context and header-version consumers', async () => {
        mockGetInfo.mockResolvedValue({ version: '1.26.0', build: '42' })
        const { store, version, api } = freshModules()
        await Promise.all([
            store.emitDeviceContextToAnalytics(),
            version.getCachedBinaryVersion(),
            api.apiFetch('/users/me'),
        ])
        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({ 'x-app-binary-version': '1.26.0' }),
            })
        )
        expect(mockGetInfo).toHaveBeenCalledTimes(1)
        expect(mockFlags).toHaveBeenCalledTimes(1)
        expect(mockFlags).toHaveBeenCalledWith({ client_platform: 'android', binary_version: '1.26.0' })
        expect(store.currentDeviceContext()).toEqual(
            expect.objectContaining({ binary_version: '1.26.0', binary_build: '42' })
        )
    })

    it('registers platform within 300ms and refreshes once when the binary arrives at 500ms', async () => {
        let resolveInfo!: (info: { version: string; build: string }) => void
        mockGetInfo.mockReturnValue(
            new Promise((resolve) => {
                resolveInfo = resolve
            })
        )
        const { store, version, setup } = freshModules()
        const emits = Promise.all([
            store.emitDeviceContextToAnalytics(),
            store.emitDeviceContextToAnalytics(),
            version.getCachedBinaryVersion(),
        ])
        await jest.advanceTimersByTimeAsync(300)
        expect(mockRegister).toHaveBeenCalledWith(
            expect.objectContaining({ platform: 'android-native', app_release: expect.any(String) })
        )
        expect(mockFlags).toHaveBeenCalledTimes(1)
        expect(mockFlags).toHaveBeenLastCalledWith({ client_platform: 'android' })
        await jest.advanceTimersByTimeAsync(200)
        resolveInfo({ version: '1.26.0', build: '42' })
        await jest.advanceTimersByTimeAsync(0)
        await emits
        await store.emitDeviceContextToAnalytics()
        expect(mockGetInfo).toHaveBeenCalledTimes(1)
        expect(mockFlags).toHaveBeenCalledTimes(2)
        expect(mockFlags).toHaveBeenLastCalledWith({ client_platform: 'android', binary_version: '1.26.0' })
        expect(setup.currentClientFlagProperties()).toEqual({ client_platform: 'android', binary_version: '1.26.0' })
        expect(store.currentDeviceContext()).toEqual(
            expect.objectContaining({ binary_version: '1.26.0', binary_build: '42' })
        )
    })

    it('finishes an emit when the native read never settles', async () => {
        mockGetInfo.mockReturnValue(new Promise(() => {}))
        const { store } = freshModules()
        const emit = store.emitDeviceContextToAnalytics()
        await jest.advanceTimersByTimeAsync(300)
        await expect(emit).resolves.toBeUndefined()
        expect(mockRegister).toHaveBeenCalledWith(
            expect.objectContaining({ platform: 'android-native', app_release: expect.any(String) })
        )
        expect(mockFlags).toHaveBeenCalledTimes(1)
        expect(mockFlags).toHaveBeenCalledWith({ client_platform: 'android' })
    })

    it.each(['invalid', 'rejected'])('does not refresh flags for a late %s result', async (outcome) => {
        let resolveInfo!: (value: { version: string; build: string }) => void
        let rejectInfo!: (error: Error) => void
        mockGetInfo.mockReturnValue(
            new Promise((resolve, reject) => {
                resolveInfo = resolve
                rejectInfo = reject
            })
        )
        const { store, setup } = freshModules()
        const emit = store.emitDeviceContextToAnalytics()
        await jest.advanceTimersByTimeAsync(500)
        await emit
        if (outcome === 'invalid') resolveInfo({ version: '10000.2.3', build: '42' })
        else rejectInfo(new Error('unavailable'))
        await jest.advanceTimersByTimeAsync(0)
        await store.emitDeviceContextToAnalytics()
        expect(mockFlags).toHaveBeenCalledTimes(1)
        expect(setup.currentClientFlagProperties()).toEqual({ client_platform: 'android' })
        expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it('contains a flag SDK error during the late refresh', async () => {
        let resolveInfo!: (value: { version: string; build: string }) => void
        mockGetInfo.mockReturnValue(
            new Promise((resolve) => {
                resolveInfo = resolve
            })
        )
        mockFlags
            .mockImplementationOnce(() => {})
            .mockImplementationOnce(() => {
                throw new Error('SDK failed')
            })
        const { store } = freshModules()
        const emit = store.emitDeviceContextToAnalytics()
        await jest.advanceTimersByTimeAsync(500)
        await emit
        resolveInfo({ version: '1.26.0', build: '42' })
        await expect(jest.advanceTimersByTimeAsync(0)).resolves.toBeUndefined()
        expect(mockFlags).toHaveBeenCalledTimes(2)
    })

    it('never queries the binary on web', async () => {
        mockPlatform.mockReturnValue('web')
        const { store, version } = freshModules()
        await Promise.all([store.emitDeviceContextToAnalytics(), version.getCachedBinaryVersion()])
        expect(mockGetInfo).not.toHaveBeenCalled()
        expect(mockFlags).toHaveBeenCalledTimes(1)
        expect(mockFlags).toHaveBeenCalledWith({ client_platform: 'web' })
    })
})

export {}
