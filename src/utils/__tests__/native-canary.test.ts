import type { captureMessage } from '@sentry/nextjs'

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
}))

jest.mock('@/constants/general.consts', () => ({
    PEANUT_API_URL: 'https://api.test.com',
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => true),
}))

jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn(() => Promise.resolve()),
    getAuthToken: jest.fn(() => 'test-token'),
}))

jest.mock('@/utils/native-auth-capture', () => ({
    getUnderlyingFetch: jest.fn(() => null),
}))

const mockNativeHttpRequest = jest.fn(() => Promise.resolve({ status: 200 } as Response))
jest.mock('@/utils/native-http', () => ({
    nativeHttpRequest: (...args: unknown[]) => mockNativeHttpRequest(...(args as [])),
}))

jest.mock(
    '@capacitor/app',
    () => ({
        App: { getInfo: jest.fn(() => Promise.resolve({ version: '1.0.31', build: '123' })) },
    }),
    { virtual: true }
)

const PROBE_NAMES = ['get-healthz', 'get-users-me', 'post-healthz', 'get-healthz-nocors', 'get-healthz-native']

// the module keeps a one-shot `scheduled` flag, so reload it for every test
// (jest.resetModules in beforeEach); resolve the mock from the same registry
const loadCanary = () => require('../native-canary') as typeof import('../native-canary')

const getCaptureMessage = () =>
    (require('@sentry/nextjs') as { captureMessage: jest.MockedFunction<typeof captureMessage> }).captureMessage

const flush = async () => {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve()
        jest.advanceTimersByTime(0)
    }
}

describe('scheduleDirectFetchCanary', () => {
    beforeEach(() => {
        jest.resetModules()
        jest.useFakeTimers()
        jest.clearAllMocks()
        mockNativeHttpRequest.mockImplementation(() => Promise.resolve({ status: 200 } as Response))
        global.fetch = jest.fn(() => Promise.resolve({ status: 401 } as Response))
        Object.defineProperty(navigator, 'serviceWorker', { value: { controller: null }, configurable: true })
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('runs all five probes with per-probe messages (dedupe cannot collapse them)', async () => {
        loadCanary().scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()

        const mockCaptureMessage = getCaptureMessage()
        expect(mockCaptureMessage).toHaveBeenCalledTimes(5)
        const messages = mockCaptureMessage.mock.calls.map((c) => c[0])
        expect(messages).toEqual(PROBE_NAMES.map((name) => `direct-fetch canary ${name}`))
        expect(new Set(messages).size).toBe(5)
        const probeNames = mockCaptureMessage.mock.calls.map((c) => (c[1] as any).tags.probe)
        expect(probeNames).toEqual(PROBE_NAMES)

        const tags = (mockCaptureMessage.mock.calls[1][1] as any).tags
        expect(tags).toMatchObject({
            canary: 'direct-fetch',
            canaryVersion: '3',
            outcome: 'http-401',
            transport: 'direct',
            authMode: 'bearer',
            appVersion: '1.0.31',
            appBuild: '123',
        })
        // swControlled is a global tag set in instrumentation-client.ts, not here
        expect(tags.swControlled).toBeUndefined()
    })

    it('sends Authorization only on the users/me probe and no credentials anywhere', async () => {
        loadCanary().scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()

        const calls = (global.fetch as jest.Mock).mock.calls
        expect(calls).toHaveLength(4)
        expect(calls[0][0]).toBe('https://api.test.com/healthz')
        expect(calls[1][0]).toBe('https://api.test.com/users/me')
        expect(calls[1][1].headers).toEqual({ Authorization: 'Bearer test-token' })
        expect(calls[2][1].method).toBe('POST')
        expect(calls[3][1].mode).toBe('no-cors')
        for (const [, init] of calls) {
            expect(init.credentials).toBeUndefined()
        }
    })

    it('probes the native transport via nativeHttpRequest, not fetch', async () => {
        loadCanary().scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()

        expect(mockNativeHttpRequest).toHaveBeenCalledTimes(1)
        expect(mockNativeHttpRequest).toHaveBeenCalledWith('https://api.test.com/healthz', { method: 'GET' }, 10_000)
        const nativeEvent = getCaptureMessage().mock.calls[4][1] as any
        expect(nativeEvent.tags).toMatchObject({
            probe: 'get-healthz-native',
            transport: 'cap-native-http',
            outcome: 'http-200',
        })
    })

    it('reports an opaque outcome for the no-cors probe', async () => {
        global.fetch = jest.fn((_url, init?: RequestInit) =>
            init?.mode === 'no-cors'
                ? Promise.resolve({ status: 0, type: 'opaque' } as Response)
                : Promise.reject(new TypeError('Failed to fetch'))
        ) as unknown as typeof fetch
        loadCanary().scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()

        const byProbe = Object.fromEntries(
            getCaptureMessage().mock.calls.map((c) => [(c[1] as any).tags.probe, c[1] as any])
        )
        expect(byProbe['get-healthz'].tags.outcome).toBe('network-error')
        expect(byProbe['get-healthz-nocors'].tags.outcome).toBe('opaque')
    })

    it('reports errorName and errorMessage on rejection', async () => {
        global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch: net::ERR_FAILED')))
        loadCanary().scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()

        const { tags, extra } = getCaptureMessage().mock.calls[0][1] as any
        expect(tags.outcome).toBe('network-error')
        expect(extra.errorName).toBe('TypeError')
        expect(extra.errorMessage).toBe('Failed to fetch: net::ERR_FAILED')
    })

    it('reports proxied transport only when the pre-wrap fetch was patched', async () => {
        const capFetch = jest.fn()
        ;(window as any).CapacitorWebFetch = capFetch
        // underlying fetch (pre-wrap) === CapacitorWebFetch → proxy NOT active,
        // even though window.fetch has since been wrapped by auth-capture
        const { getUnderlyingFetch } = require('@/utils/native-auth-capture')
        ;(getUnderlyingFetch as jest.Mock).mockReturnValue(capFetch)

        loadCanary().scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()

        const tags = (getCaptureMessage().mock.calls[0][1] as any).tags
        expect(tags.transport).toBe('direct')
        delete (window as any).CapacitorWebFetch
    })

    it('is one-shot per module load', async () => {
        const canary = loadCanary()
        canary.scheduleDirectFetchCanary(0)
        canary.scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()
        expect(getCaptureMessage()).toHaveBeenCalledTimes(5)
    })
})
