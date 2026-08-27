import * as Sentry from '@sentry/nextjs'
import { runCanary, scheduleTransportCanary } from '../native-canary'

jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn() }))
jest.mock('../capacitor', () => ({ isNativeBridge: jest.fn(() => true) }))
jest.mock('../native-auth-capture', () => ({ getUnderlyingFetch: () => null }))
jest.mock('../native-http', () => ({ nativeHttpRequest: jest.fn() }))
jest.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ version: '1.0.57', build: '412' }) } }), {
    virtual: true,
})

const { nativeHttpRequest } = jest.requireMock('../native-http') as { nativeHttpRequest: jest.Mock }
const { isNativeBridge } = jest.requireMock('../capacitor') as { isNativeBridge: jest.Mock }
const captureMessage = Sentry.captureMessage as jest.Mock

const ok = (status = 200) => ({ status }) as Response

function mockWebFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
    global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) =>
        impl(String(url), init)
    ) as unknown as typeof fetch
}

beforeEach(() => {
    jest.clearAllMocks()
    nativeHttpRequest.mockResolvedValue(ok())
    mockWebFetch(async () => ok())
})

describe('transport canary', () => {
    it('stays silent when every probe succeeds', async () => {
        await runCanary()
        expect(captureMessage).not.toHaveBeenCalled()
    })

    it('stays silent on non-2xx, because a completed request is not a transport failure', async () => {
        mockWebFetch(async (_url, init) => ok(init?.method === 'POST' ? 405 : 200))
        await runCanary()
        expect(captureMessage).not.toHaveBeenCalled()
    })

    it('reports the Android shape: webview GET fails while POST and native succeed', async () => {
        mockWebFetch(async (_url, init) => {
            if ((init?.method ?? 'GET') === 'GET') throw new TypeError('Failed to fetch: net::ERR_FAILED')
            return ok(405)
        })

        await runCanary()

        expect(captureMessage).toHaveBeenCalledTimes(1)
        const [message, options] = captureMessage.mock.calls[0]
        expect(message).toBe('native canary: get:fail post:ok native:ok')
        expect(options.level).toBe('warning')
        expect(options.tags).toMatchObject({
            canary: 'transport',
            canary_get: 'network-error',
            canary_post: 'http-405',
            canary_native: 'http-200',
            appVersion: '1.0.57',
            appBuild: '412',
        })
        // the net:: code is the field most likely to name the root cause
        expect(options.extra.get.errorMessage).toContain('net::ERR_FAILED')
    })

    it('classifies an aborted probe as a timeout', async () => {
        mockWebFetch(async () => {
            const e = new Error('aborted')
            e.name = 'AbortError'
            throw e
        })
        nativeHttpRequest.mockResolvedValue(ok())

        await runCanary()

        const [message, options] = captureMessage.mock.calls[0]
        expect(message).toBe('native canary: get:fail post:fail native:ok')
        expect(options.tags.canary_get).toBe('timeout')
    })

    it('reports a total outage rather than staying silent', async () => {
        mockWebFetch(async () => {
            throw new TypeError('Failed to fetch')
        })
        nativeHttpRequest.mockRejectedValue(new TypeError('Failed to fetch'))

        await runCanary()

        expect(captureMessage).toHaveBeenCalledTimes(1)
        expect(captureMessage.mock.calls[0][0]).toBe('native canary: get:fail post:fail native:fail')
    })

    it('issues exactly three probes, none of them no-cors — iOS serves no opaque responses', async () => {
        mockWebFetch(async () => {
            throw new TypeError('Failed to fetch')
        })
        await runCanary()

        const modes = (global.fetch as jest.Mock).mock.calls.map(([, init]) => init?.mode)
        expect(modes).toHaveLength(2)
        expect(modes.every((m) => m === undefined)).toBe(true)
        expect(nativeHttpRequest).toHaveBeenCalledTimes(1)
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
        jest.useRealTimers()
    })
})
