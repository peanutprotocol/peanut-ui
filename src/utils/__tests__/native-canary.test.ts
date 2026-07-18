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

jest.mock(
    '@capacitor/app',
    () => ({
        App: { getInfo: jest.fn(() => Promise.resolve({ version: '1.0.31', build: '123' })) },
    }),
    { virtual: true }
)

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
        global.fetch = jest.fn(() => Promise.resolve({ status: 401 } as Response))
        Object.defineProperty(navigator, 'serviceWorker', { value: { controller: null }, configurable: true })
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('runs all three probes and reports per-probe tags', async () => {
        loadCanary().scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()

        const mockCaptureMessage = getCaptureMessage()
        expect(mockCaptureMessage).toHaveBeenCalledTimes(3)
        const probeNames = mockCaptureMessage.mock.calls.map((c) => (c[1] as any).tags.probe)
        expect(probeNames).toEqual(['get-healthz', 'get-users-me', 'post-healthz'])

        const tags = (mockCaptureMessage.mock.calls[1][1] as any).tags
        expect(tags).toMatchObject({
            canary: 'direct-fetch',
            canaryVersion: '2',
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
        expect(calls).toHaveLength(3)
        expect(calls[0][0]).toBe('https://api.test.com/healthz')
        expect(calls[1][0]).toBe('https://api.test.com/users/me')
        expect(calls[1][1].headers).toEqual({ Authorization: 'Bearer test-token' })
        expect(calls[2][1].method).toBe('POST')
        for (const [, init] of calls) {
            expect(init.credentials).toBeUndefined()
        }
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

    it('is one-shot per module load', async () => {
        const canary = loadCanary()
        canary.scheduleDirectFetchCanary(0)
        canary.scheduleDirectFetchCanary(0)
        jest.advanceTimersByTime(0)
        await flush()
        expect(getCaptureMessage()).toHaveBeenCalledTimes(3)
    })
})
