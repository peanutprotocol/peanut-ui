// fetchWithSentry's native-transport fallback (PEANUT-UI-R5F): when the
// WebView fetch rejects and the request is native-eligible, it retries over
// CapacitorHttp before reporting a connectivity failure.
import { fetchWithSentry } from '../sentry.utils'
import { reportNetworkError } from '../connectivity'
import { canUseNativeHttp, nativeHttpRequest } from '../native-http'
import * as Sentry from '@sentry/nextjs'

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    withScope: jest.fn((cb: (scope: unknown) => void) => cb({ setFingerprint: jest.fn(), setTag: jest.fn() })),
}))

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

describe('fetchWithSentry native fallback', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    })

    it('returns the native response when the WebView fetch is rejected', async () => {
        mockCanUse.mockReturnValue(true)
        mockNativeRequest.mockResolvedValue(fakeResponse(200))

        const res = await fetchWithSentry('https://api.test.com/misc', { method: 'GET' })

        expect(res.status).toBe(200)
        expect(mockNativeRequest).toHaveBeenCalledWith(
            'https://api.test.com/misc',
            { method: 'GET' },
            expect.any(Number)
        )
        expect(reportNetworkError).not.toHaveBeenCalled()
        // the rescue itself is not a Sentry event — only a genuine failure is
        await fetchWithSentry('https://api.test.com/misc', { method: 'GET' })
        const engaged = (Sentry.captureMessage as jest.Mock).mock.calls.filter((c) =>
            String(c[0]).includes('fallback engaged')
        )
        expect(engaged).toHaveLength(0)
    })

    it('still reports non-ok statuses from the fallback transport', async () => {
        mockCanUse.mockReturnValue(true)
        mockNativeRequest.mockResolvedValue(fakeResponse(503))

        const res = await fetchWithSentry('https://api.test.com/misc', { method: 'GET' })

        expect(res.status).toBe(503)
        const statusReports = (Sentry.captureMessage as jest.Mock).mock.calls.filter((c) =>
            String(c[0]).includes('failed with status 503')
        )
        expect(statusReports).toHaveLength(1)
    })

    it('falls through to the normal error path when the fallback also fails', async () => {
        mockCanUse.mockReturnValue(true)
        mockNativeRequest.mockRejectedValue(new Error('bridge unavailable'))

        await expect(fetchWithSentry('https://api.test.com/misc', { method: 'GET' })).rejects.toMatchObject({
            name: 'ServiceUnavailableError',
        })
        expect(reportNetworkError).toHaveBeenCalled()
        expect(Sentry.captureException).toHaveBeenCalled()
    })

    it('never engages off-native (canUseNativeHttp false)', async () => {
        mockCanUse.mockReturnValue(false)

        await expect(fetchWithSentry('https://api.test.com/misc', { method: 'GET' })).rejects.toMatchObject({
            name: 'ServiceUnavailableError',
        })
        expect(mockNativeRequest).not.toHaveBeenCalled()
        expect(reportNetworkError).toHaveBeenCalled()
    })
})
