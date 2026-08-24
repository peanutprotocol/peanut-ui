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
