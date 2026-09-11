import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { runCanary, scheduleTransportCanary } from '../native-canary'

jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('../capacitor', () => ({ isNativeBridge: jest.fn(() => true), isCapacitor: jest.fn(() => true) }))
jest.mock('../passkey-auth-capture', () => ({ getUnderlyingFetch: () => null }))
jest.mock('../native-http', () => ({ nativeHttpRequest: jest.fn() }))
// Mocked at the consumer boundary rather than as a (virtual) @capacitor/app
// module: another suite in the same worker mocking that package non-virtually
// made this one resolve the real plugin and tag the event 'unknown'.
jest.mock('../app-version', () => ({ getBinaryInfo: async () => ({ appVersion: '1.0.57', appBuild: '412' }) }))

const { nativeHttpRequest } = jest.requireMock('../native-http') as { nativeHttpRequest: jest.Mock }
const { isNativeBridge } = jest.requireMock('../capacitor') as { isNativeBridge: jest.Mock }
const captureMessage = Sentry.captureMessage as jest.Mock
const capturePosthog = posthog.capture as jest.Mock

const ok = (status = 200) => ({ status }) as Response

function mockWebFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
    global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) =>
        impl(String(url), init)
    ) as unknown as typeof fetch
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    capturePosthog.mockReturnValue({ uuid: 'accepted-for-send' })
    nativeHttpRequest.mockResolvedValue(ok())
    mockWebFetch(async () => ok())
})

afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
})

describe('transport canary', () => {
    it('stays silent and skips the control when every primary probe succeeds', async () => {
        await runCanary()

        expect(captureMessage).not.toHaveBeenCalled()
        expect(capturePosthog).not.toHaveBeenCalled()
        expect(nativeHttpRequest).toHaveBeenCalledTimes(1)
    })

    it('stays silent on non-2xx, because a completed request is not a transport failure', async () => {
        mockWebFetch(async (_url, init) => ok(init?.method === 'POST' ? 405 : 200))

        await runCanary()

        expect(captureMessage).not.toHaveBeenCalled()
    })

    it('reports and fingerprints the Android asymmetric transport shape', async () => {
        mockWebFetch(async (_url, init) => {
            if ((init?.method ?? 'GET') === 'GET') throw new TypeError('Failed to fetch: net::ERR_FAILED')
            return ok(405)
        })

        await runCanary()

        expect(captureMessage).toHaveBeenCalledTimes(1)
        const [message, options] = captureMessage.mock.calls[0]
        expect(message).toBe('native canary: get:fail post:ok native:ok')
        expect(options.level).toBe('warning')
        expect(options.fingerprint).toEqual([
            'native-canary-v7',
            'transport-asymmetry',
            'get:fail post:ok native:ok',
            'direct',
        ])
        expect(options.tags).toMatchObject({
            canary: 'transport',
            canaryVersion: '7',
            canary_classification: 'transport-asymmetry',
            canary_get: 'network-error',
            canary_post: 'http-405',
            canary_native: 'http-200',
            canary_internet: 'not-run',
            appVersion: '1.0.57',
            appBuild: '412',
        })
        // the net:: code is the field most likely to name the root cause
        expect(options.extra.get.errorMessage).toContain('net::ERR_FAILED')
        expect(capturePosthog).toHaveBeenCalledWith(
            'native_transport_canary_failed',
            expect.objectContaining({
                canary_classification: 'transport-asymmetry',
                sentry_sampled: true,
            })
        )
        expect(nativeHttpRequest).toHaveBeenCalledTimes(1)
    })

    it('does not let a PostHog failure suppress the actionable Sentry warning', async () => {
        mockWebFetch(async (_url, init) => {
            if ((init?.method ?? 'GET') === 'GET') throw new TypeError('Failed to fetch')
            return ok(405)
        })
        capturePosthog.mockImplementationOnce(() => {
            throw new Error('PostHog unavailable')
        })

        await runCanary()

        expect(captureMessage).toHaveBeenCalledTimes(1)
        expect(captureMessage.mock.calls[0][1].tags.canary_classification).toBe('transport-asymmetry')
    })

    it('classifies an aborted probe as a timeout', async () => {
        mockWebFetch(async () => {
            const e = new Error('aborted')
            e.name = 'AbortError'
            throw e
        })

        await runCanary()

        const [message, options] = captureMessage.mock.calls[0]
        expect(message).toBe('native canary: get:fail post:fail native:ok')
        expect(options.tags.canary_get).toBe('timeout')
    })

    it('reports an API-host outage when the independent internet control succeeds', async () => {
        mockWebFetch(async () => {
            throw new TypeError('Failed to fetch')
        })
        nativeHttpRequest.mockImplementation(async (url: string) => {
            if (url.includes('api.peanut.me')) throw new TypeError('Unable to resolve host api.peanut.me')
            return ok(204)
        })

        await runCanary()

        expect(captureMessage).toHaveBeenCalledTimes(1)
        expect(captureMessage.mock.calls[0][0]).toBe('native canary: get:fail post:fail native:fail')
        expect(captureMessage.mock.calls[0][1]).toMatchObject({
            level: 'warning',
            fingerprint: ['native-canary-v7', 'api-unreachable', 'get:fail post:fail native:fail', 'direct'],
            tags: {
                canary_classification: 'api-unreachable',
                canary_capgo: 'http-204',
                canary_internet: 'http-204',
            },
        })
        expect(nativeHttpRequest).toHaveBeenCalledTimes(3)
    })

    it('keeps whole-device connectivity in PostHog when the daily Sentry sample is not selected', async () => {
        mockWebFetch(async () => {
            throw new TypeError('Failed to fetch')
        })
        nativeHttpRequest.mockRejectedValue(new TypeError('Unable to resolve host'))
        jest.spyOn(Math, 'random').mockReturnValue(0.5)

        await runCanary()

        expect(captureMessage).not.toHaveBeenCalled()
        expect(capturePosthog).toHaveBeenCalledWith(
            'native_transport_canary_failed',
            expect.objectContaining({
                canary_classification: 'device-connectivity',
                canary_capgo: 'network-error',
                canary_internet: 'network-error',
                sentry_sampled: false,
                canary_replayed: false,
            }),
            expect.objectContaining({ uuid: expect.any(String) })
        )
        expect(localStorage.getItem('nativeCanaryConnectivityOutboxV1')).not.toBeNull()
    })

    it('replays a persisted offline event once after close and online relaunch', async () => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
        mockWebFetch(async () => {
            throw new TypeError('Failed to fetch')
        })
        nativeHttpRequest.mockRejectedValue(new TypeError('Unable to resolve host'))
        jest.spyOn(Math, 'random').mockReturnValue(0.5)

        await runCanary()

        const firstProperties = capturePosthog.mock.calls[0][1]
        const firstOptions = capturePosthog.mock.calls[0][2]
        expect(firstProperties).toMatchObject({
            canary_classification: 'device-connectivity',
            canary_replayed: false,
        })
        expect(firstOptions.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

        // Simulate a killed process: SDK memory is gone, durable storage remains.
        capturePosthog.mockReset().mockReturnValue({ uuid: 'accepted-for-send' })
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
        nativeHttpRequest.mockResolvedValue(ok())
        mockWebFetch(async () => ok())

        await runCanary()
        await runCanary()

        expect(capturePosthog).toHaveBeenCalledTimes(1)
        expect(capturePosthog).toHaveBeenCalledWith(
            'native_transport_canary_failed',
            expect.objectContaining({
                canary_classification: 'device-connectivity',
                canary_replayed: true,
                canary_original_captured_at: expect.any(String),
            }),
            { send_instantly: true, uuid: firstOptions.uuid }
        )
    })

    it('samples whole-device connectivity into Sentry at info level at most once per day', async () => {
        mockWebFetch(async () => {
            throw new TypeError('Failed to fetch')
        })
        nativeHttpRequest.mockRejectedValue(new TypeError('Unable to resolve host'))
        jest.spyOn(Math, 'random').mockReturnValue(0)

        await runCanary()
        await runCanary()

        expect(capturePosthog).toHaveBeenCalledTimes(3)
        expect(capturePosthog.mock.calls[1][2].uuid).toBe(capturePosthog.mock.calls[0][2].uuid)
        expect(capturePosthog.mock.calls[2][2].uuid).not.toBe(capturePosthog.mock.calls[0][2].uuid)
        expect(JSON.parse(localStorage.getItem('nativeCanaryConnectivityOutboxV1') ?? '[]')).toHaveLength(2)
        expect(captureMessage).toHaveBeenCalledTimes(1)
        expect(captureMessage.mock.calls[0][1]).toMatchObject({
            level: 'info',
            fingerprint: ['native-canary-v7', 'device-connectivity', 'get:fail post:fail native:fail', 'direct'],
        })
    })

    it('uses a simple POST without an application/json preflight', async () => {
        await runCanary()

        const [, postInit] = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')
        expect(postInit).toMatchObject({ method: 'POST', body: '{}' })
        expect(postInit.headers).toBeUndefined()
    })

    it('enforces the ten-second wall-clock timeout when fetch ignores abort', async () => {
        jest.useFakeTimers()
        mockWebFetch(() => new Promise<Response>(() => {}))

        const run = runCanary()
        await jest.advanceTimersByTimeAsync(10_000)
        await run

        expect(captureMessage).toHaveBeenCalledTimes(1)
        expect(captureMessage.mock.calls[0][1].tags).toMatchObject({
            canary_get: 'timeout',
            canary_post: 'timeout',
            canary_native: 'http-200',
        })
    })

    it('keeps WebView probes CORS-readable and uses native HTTP for both external controls', async () => {
        mockWebFetch(async () => {
            throw new TypeError('Failed to fetch')
        })
        nativeHttpRequest.mockRejectedValue(new TypeError('Failed to fetch'))
        jest.spyOn(Math, 'random').mockReturnValue(0.5)

        await runCanary()

        const modes = (global.fetch as jest.Mock).mock.calls.map(([, init]) => init?.mode)
        expect(modes).toHaveLength(2)
        expect(modes.every((m) => m === undefined)).toBe(true)
        expect(nativeHttpRequest).toHaveBeenCalledTimes(3)
        expect(nativeHttpRequest).toHaveBeenCalledWith('https://plugin.capgo.app/', { method: 'GET' }, 10_000)
        expect(nativeHttpRequest).toHaveBeenCalledWith(
            'https://www.gstatic.com/generate_204',
            { method: 'GET' },
            10_000
        )
    })

    /*
     * isCapacitor() is true for NEXT_PUBLIC_CAPACITOR_BUILD Vercel previews
     * that have no bridge; probing there files web-fallback results as native
     * transport evidence under appVersion 'unknown'.
     */
    it('does not schedule on a capacitor-flavoured build with no native bridge', () => {
        jest.useFakeTimers()
        isNativeBridge.mockReturnValue(false)

        scheduleTransportCanary(0)
        jest.runAllTimers()

        expect(global.fetch).not.toHaveBeenCalled()
        expect(nativeHttpRequest).not.toHaveBeenCalled()
    })
})
