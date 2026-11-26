/**
 * "I've sent the transfer" tells the API (peanut-api-ts#2314) so the landing push opens the card step.
 * The API ships first; a UI that reaches an API without the route must stay quiet (TASK-25169).
 */
import { cardApi } from '@/services/card'
import * as Sentry from '@/utils/sentry-lazy'
import { fetchWithSentry, resetNonOkReportThrottle } from '@/utils/sentry.utils'

const mockApiFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/auth-token', () => ({ authReady: async () => undefined, getAuthToken: () => 'jwt' }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/sentry-lazy', () => ({
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
    withScope: (cb: (scope: unknown) => void) => cb({ setFingerprint: jest.fn(), setTag: jest.fn() }),
}))
jest.mock('@/utils/connectivity', () => ({
    getConnectivityGeneration: () => 0,
    hasRecentFailure: () => false,
    reportNetworkError: jest.fn(),
}))

// the jsdom environment has no Response: the service reads only ok and status
const answer = (status: number) => ({ ok: status >= 200 && status < 300, status })

beforeEach(() => mockApiFetch.mockReset())

describe('cardApi.markFundingPending', () => {
    it('posts with no body: the session names the user', async () => {
        mockApiFetch.mockResolvedValue(answer(200))
        await cardApi.markFundingPending()
        expect(mockApiFetch).toHaveBeenCalledWith('/card/funding-pending', {
            method: 'POST',
            callerReportsFailures: true,
        })
    })

    it('sends no Sentry report from the fetch layer for a 404: the options it passes keep it quiet', async () => {
        mockApiFetch.mockResolvedValue(answer(404))
        await cardApi.markFundingPending()
        const [, options] = mockApiFetch.mock.calls[0]
        // the real reporting decision, fed the options the service passes and a 404
        resetNonOkReportThrottle()
        const notFound = { ok: false, status: 404, clone: () => ({ json: async () => ({}), text: async () => '{}' }) }
        global.fetch = jest.fn().mockResolvedValue(notFound) as unknown as typeof fetch
        await fetchWithSentry('https://api.test/card/funding-pending', options)
        expect(Sentry.captureMessage).not.toHaveBeenCalled()
        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('stays quiet when the API does not have the route yet (404)', async () => {
        mockApiFetch.mockResolvedValue(answer(404))
        await expect(cardApi.markFundingPending()).resolves.toBeUndefined()
    })

    it('fails on any other error, so the caller reports it', async () => {
        mockApiFetch.mockResolvedValue(answer(500))
        await expect(cardApi.markFundingPending()).rejects.toThrow('500')
    })
})
