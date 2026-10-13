// One immediate retry for a caller-marked idempotent mutation whose fetch
// rejected before any response (PEANUT-UI-T0D: WebKit `Load failed` on the
// first POST after an idle gap). Nothing else changes: timeouts, HTTP
// responses and non-idempotent mutations are never resent.
import { fetchWithSentry, isPreResponseNetworkError } from '../sentry.utils'

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
    withScope: jest.fn((cb: (scope: unknown) => void) => cb({ setFingerprint: jest.fn(), setTag: jest.fn() })),
}))
jest.mock('@/utils/sentry-lazy', () => require('@sentry/nextjs'))
jest.mock('../connectivity', () => ({
    getConnectivityGeneration: jest.fn(() => 0),
    reportNetworkError: jest.fn(),
    hasRecentFailure: jest.fn(() => false),
}))
jest.mock('../native-http', () => ({
    canUseNativeHttp: jest.fn(() => false),
    nativeHttpRequest: jest.fn(),
}))

const URL = 'https://api.test.com/update-user'
const okResponse = { ok: true, status: 200 } as Response
const fakeResponse = (status: number) =>
    ({
        ok: false,
        status,
        clone: () => ({ json: async () => ({ error: 'x' }), text: async () => 'x' }),
    }) as unknown as Response
const abortError = () => Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })

let fetchMock: jest.Mock
beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {})
    fetchMock = jest.fn()
    global.fetch = fetchMock
})
afterEach(() => jest.restoreAllMocks())

describe('isPreResponseNetworkError', () => {
    it.each(['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.'])(
        'matches the engine message %p',
        (message) => expect(isPreResponseNetworkError(new TypeError(message))).toBe(true)
    )
    it('rejects timeouts, other TypeErrors and non-errors', () => {
        expect(isPreResponseNetworkError(abortError())).toBe(false)
        expect(isPreResponseNetworkError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
            false
        )
        expect(isPreResponseNetworkError('Load failed')).toBe(false)
    })
})

describe('fetchWithSentry idempotent mutation retry', () => {
    it('retries an idempotent POST once when fetch rejects before a response', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Load failed')).mockResolvedValueOnce(okResponse)

        const res = await fetchWithSentry(URL, { method: 'POST', body: '{}', idempotent: true })

        expect(res).toBe(okResponse)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        // the flag is ours, not a fetch option
        expect(fetchMock.mock.calls[1][1]).not.toHaveProperty('idempotent')
    })

    it('retries only once', async () => {
        fetchMock.mockRejectedValue(new TypeError('Load failed'))

        await expect(fetchWithSentry(URL, { method: 'POST', idempotent: true })).rejects.toMatchObject({
            name: 'ServiceUnavailableError',
        })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('never retries a POST without the flag', async () => {
        fetchMock.mockRejectedValue(new TypeError('Load failed'))

        await expect(fetchWithSentry(URL, { method: 'POST' })).rejects.toMatchObject({
            name: 'ServiceUnavailableError',
        })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('never retries a timeout of an idempotent POST', async () => {
        fetchMock.mockRejectedValue(abortError())

        await expect(fetchWithSentry(URL, { method: 'POST', idempotent: true })).rejects.toMatchObject({
            name: 'ConnectionTimeoutError',
        })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('never retries an HTTP error response', async () => {
        fetchMock.mockResolvedValue(fakeResponse(503))

        const res = await fetchWithSentry(URL, { method: 'POST', idempotent: true })

        expect(res.status).toBe(503)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not retry an unrelated TypeError', async () => {
        fetchMock.mockRejectedValue(new TypeError('Invalid header value'))

        await expect(fetchWithSentry(URL, { method: 'POST', idempotent: true })).rejects.toThrow()
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('leaves GET unchanged: no retry on a network error, even with the flag', async () => {
        fetchMock.mockRejectedValue(new TypeError('Load failed'))

        await expect(fetchWithSentry(URL, { method: 'GET', idempotent: true })).rejects.toMatchObject({
            name: 'ServiceUnavailableError',
        })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
