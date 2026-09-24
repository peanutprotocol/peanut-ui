import * as Sentry from '@sentry/nextjs'
import { fetchWithSentry } from '../sentry.utils'
import { reportNetworkError } from '../connectivity'

jest.mock('@sentry/nextjs', () => ({
    withScope: jest.fn(),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
}))

jest.mock('@/utils/sentry-lazy', () => require('@sentry/nextjs'))

jest.mock('../connectivity', () => ({
    getConnectivityGeneration: jest.fn(() => 0),
    reportNetworkError: jest.fn(),
    hasRecentFailure: jest.fn(() => false),
}))

const URL = 'https://api.peanut.me/users/history?limit=50'

/** A fetch that stays open until its own signal aborts, like a slow server. */
const hangingFetch = jest.fn(
    (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
                reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            )
        })
)

/*
 * React Query cancels a fetch it superseded. The timeout controller used to
 * replace the caller's signal, so the cancel never reached the network: on
 * 2026-09-24 ~100 superseded history requests kept running on staging.
 */
describe('fetchWithSentry — the caller can cancel', () => {
    let infoSpy: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
        global.fetch = hangingFetch as unknown as typeof fetch
    })

    afterEach(() => infoSpy.mockRestore())

    it('aborts the request in flight, without a retry or a report', async () => {
        const caller = new AbortController()
        const request = fetchWithSentry(URL, { signal: caller.signal })
        caller.abort()

        await expect(request).rejects.toMatchObject({ name: 'AbortError' })
        expect(hangingFetch).toHaveBeenCalledTimes(1)
        expect(hangingFetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(reportNetworkError).not.toHaveBeenCalled()
    })

    it('does not start a request the caller already cancelled', async () => {
        const caller = new AbortController()
        caller.abort()

        await expect(fetchWithSentry(URL, { signal: caller.signal })).rejects.toMatchObject({ name: 'AbortError' })
        expect(hangingFetch).not.toHaveBeenCalled()
    })

    it('still times out, retries once and reports, when the caller has not cancelled', async () => {
        const caller = new AbortController()

        await expect(fetchWithSentry(URL, { signal: caller.signal }, 500)).rejects.toThrow(/taking too long/)
        expect(hangingFetch).toHaveBeenCalledTimes(2)
        expect(Sentry.withScope).toHaveBeenCalled()
    })
})
