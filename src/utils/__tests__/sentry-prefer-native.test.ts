// fetchWithSentry's preferNativeTransport path: tokenless native sessions go
// over the OS HTTP client FIRST (the legacy cookie-jar JWT only rides there),
// falling through to the WebView path when the OS client fails.
import { fetchWithSentry } from '../sentry.utils'
import { reportNetworkError } from '../connectivity'
import { canUseNativeHttp, nativeHttpRequest } from '../native-http'
import * as Sentry from '@sentry/nextjs'

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    withScope: jest.fn((cb: (scope: unknown) => void) => cb({ setFingerprint: jest.fn(), setTag: jest.fn() })),
}))

// sentry.utils reports through the lazy wrapper, which dynamically imports the
// SDK. Its surface matches the mock above, so aliasing it keeps the calls
// synchronous and the assertions below unchanged.
jest.mock('@/utils/sentry-lazy', () => require('@sentry/nextjs'))

jest.mock('../connectivity', () => ({
    reportNetworkError: jest.fn(),
    // fetchWithSentry consults this before capturing, to report one failure per
    // endpoint per window. Always-false keeps every capture assertion below live.
    hasRecentFailure: jest.fn(() => false),
}))

jest.mock('../native-http', () => ({
    canUseNativeHttp: jest.fn(() => false),
    nativeHttpRequest: jest.fn(),
}))

const mockCanUse = canUseNativeHttp as jest.MockedFunction<typeof canUseNativeHttp>
const mockNativeRequest = nativeHttpRequest as jest.MockedFunction<typeof nativeHttpRequest>

const fakeResponse = (status: number) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        clone: () => ({ json: async () => ({ error: 'x' }), text: async () => 'x' }),
    }) as unknown as Response

const transportNotices = () =>
    (Sentry.captureMessage as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('transport engaged'))

/*
 * `timeoutMs` bounds a caller-visible attempt, not each transport leg. It used
 * to be handed fresh to every leg, so a native POST spent it in the WebView
 * fetch and again in the OS-client fallback — twice the bound every call site
 * documents, and on a QR scan four React Query attempts each paid it.
 */
describe('fetchWithSentry — one budget across the transport legs', () => {
    const abort = () => Object.assign(new Error('aborted'), { name: 'AbortError' })

    beforeEach(() => {
        jest.clearAllMocks()
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })

    afterEach(() => jest.restoreAllMocks())

    it('gives the fallback only what the timed-out WebView leg left', async () => {
        mockCanUse.mockReturnValue(true)
        // A POST gets one WebView attempt, and it burns the whole budget.
        global.fetch = jest.fn(
            () => new Promise((_, reject) => setTimeout(() => reject(abort()), 60)) as Promise<Response>
        )
        mockNativeRequest.mockResolvedValue(fakeResponse(200))

        await expect(
            fetchWithSentry('https://api.test.com/manteca/qr-payment/init', { method: 'POST', body: '{}' }, 50)
        ).rejects.toThrow(/taking too long/)

        // Pool spent, so the fallback is skipped rather than starting a second
        // full-length leg. Before, this call cost 2 x 50ms.
        expect(mockNativeRequest).not.toHaveBeenCalled()
    })

    /*
     * The case the fallback exists for (PEANUT-UI-R5F): the edge rejects the
     * WebView at the TLS layer, so it fails FAST and the pool is still nearly
     * whole. Bounding the call must not cost the fallback its budget here.
     */
    it('still hands the fallback a full leg when the WebView rejects fast', async () => {
        mockCanUse.mockReturnValue(true)
        global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')))
        mockNativeRequest.mockResolvedValue(fakeResponse(200))

        const res = await fetchWithSentry(
            'https://api.test.com/manteca/qr-payment/init',
            { method: 'POST', body: '{}' },
            5_000
        )

        expect(res.status).toBe(200)
        const grantedMs = mockNativeRequest.mock.calls[0][2] as number
        expect(grantedMs).toBeGreaterThan(4_000)
        expect(grantedMs).toBeLessThanOrEqual(5_000)
    })

    // R44's silent GET retry is per-attempt and keeps its own budget: a GET is
    // allowed two transport attempts, so its pool is sized for both.
    it('leaves the idempotent GET retry a full second attempt', async () => {
        mockCanUse.mockReturnValue(false)
        const seen: number[] = []
        global.fetch = jest.fn(() => {
            seen.push(Date.now())
            return new Promise((_, reject) => setTimeout(() => reject(abort()), 60)) as Promise<Response>
        })

        await expect(fetchWithSentry('https://api.test.com/users/me', {}, 50)).rejects.toThrow(/taking too long/)

        expect(seen).toHaveLength(2)
    })
})

describe('fetchWithSentry preferNativeTransport', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        global.fetch = jest.fn(() => Promise.resolve(fakeResponse(200)))
    })

    it('sends over the OS client first, without touching the WebView fetch', async () => {
        mockCanUse.mockReturnValue(true)
        mockNativeRequest.mockResolvedValue(fakeResponse(200))

        const res = await fetchWithSentry('https://api.test.com/manteca/qr-payment/init', {
            method: 'POST',
            body: '{}',
            preferNativeTransport: true,
        })

        expect(res.status).toBe(200)
        expect(global.fetch).not.toHaveBeenCalled()
        expect(mockNativeRequest).toHaveBeenCalledWith(
            'https://api.test.com/manteca/qr-payment/init',
            { method: 'POST', body: '{}' },
            expect.any(Number)
        )
        expect(reportNetworkError).not.toHaveBeenCalled()

        // which transport carried the request is not a Sentry event
        await fetchWithSentry('https://api.test.com/users/me', { method: 'GET', preferNativeTransport: true })
        expect(transportNotices()).toHaveLength(0)
    })

    it('still reports non-ok statuses from the preferred transport', async () => {
        mockCanUse.mockReturnValue(true)
        mockNativeRequest.mockResolvedValue(fakeResponse(503))

        const res = await fetchWithSentry('https://api.test.com/users/me', {
            method: 'GET',
            preferNativeTransport: true,
        })

        expect(res.status).toBe(503)
        const statusReports = (Sentry.captureMessage as jest.Mock).mock.calls.filter((c) =>
            String(c[0]).includes('failed with status 503')
        )
        expect(statusReports).toHaveLength(1)
    })

    it('falls through to the WebView path when the OS client rejects', async () => {
        mockCanUse.mockReturnValue(true)
        mockNativeRequest.mockRejectedValue(new Error('bridge unavailable'))

        const res = await fetchWithSentry('https://api.test.com/users/me', {
            method: 'GET',
            preferNativeTransport: true,
        })

        expect(res.status).toBe(200)
        expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('skips the OS client for native-ineligible requests (canUseNativeHttp false)', async () => {
        mockCanUse.mockReturnValue(false)

        await fetchWithSentry('https://api.test.com/upload', { method: 'POST', preferNativeTransport: true })

        expect(mockNativeRequest).not.toHaveBeenCalled()
        expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('never engages without the flag', async () => {
        mockCanUse.mockReturnValue(true)

        await fetchWithSentry('https://api.test.com/users/me', { method: 'GET' })

        expect(mockNativeRequest).not.toHaveBeenCalled()
        expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('strips preferNativeTransport before the WebView fetch', async () => {
        mockCanUse.mockReturnValue(false)

        await fetchWithSentry('https://api.test.com/users/me', { method: 'GET', preferNativeTransport: true })

        const init = (global.fetch as jest.Mock).mock.calls[0][1]
        expect(init).not.toHaveProperty('preferNativeTransport')
    })
})
