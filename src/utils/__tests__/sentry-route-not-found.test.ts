import * as Sentry from '@/utils/sentry-lazy'
import { fetchWithSentry, resetNonOkReportThrottle } from '../sentry.utils'

jest.mock('@/utils/sentry-lazy', () => ({
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
    withScope: (cb: (scope: unknown) => void) => cb({ setFingerprint: jest.fn(), setTag: jest.fn() }),
}))
jest.mock('../connectivity', () => ({
    getConnectivityGeneration: () => 0,
    hasRecentFailure: () => false,
    reportNetworkError: jest.fn(),
}))

beforeEach(() => {
    jest.clearAllMocks()
    resetNonOkReportThrottle()
})

it.each([
    [{ error: 'User not found' }, false],
    [{ error: 'Not Found', code: 'route_not_found' }, true],
    [{ error: 'route_not_found' }, false],
])('filters users 404 by the structured code: %p', async (body, reported) => {
    const res = {
        ok: false,
        status: 404,
        clone: () => ({ json: async () => body, text: async () => JSON.stringify(body) }),
    }
    global.fetch = jest.fn().mockResolvedValue(res)
    await fetchWithSentry('https://api.test/users/kyc/plan')
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(reported ? 1 : 0)
})
