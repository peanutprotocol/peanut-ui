jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * APK #4: a fresh user on Smart Paperwork Verification tapped Verify, the plan
 * GET failed (Android WebView GETs fail intermittently), and the failed read
 * was taken for "today's flow". The legacy initiate then opened an applicant
 * that shuts the user out of the new flow for good. The API now refuses that
 * start (409 paperwork_verification_required), so an unreadable plan still
 * starts: a legacy user verifies, a new-flow user is sent to /verify.
 *
 * The plan read is real here, down to the fetch, because the bug lived in how
 * a failed read was turned into an answer.
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    initiateSumsubKyc: jest.fn(),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: () => {} }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { username: 'test' } } }) }))
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>

beforeEach(() => {
    jest.useFakeTimers()
    mockFetch.mockReset()
    mockInitiate.mockReset()
    mockRouterPush.mockReset()
})
afterEach(() => jest.useRealTimers())

const startWithUnreadablePlan = async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        const started = result.current.handleInitiateKyc('EU')
        await jest.runAllTimersAsync()
        await started
    })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    return result
}

it('a plan that cannot be read still starts today’s verification for a legacy user', async () => {
    mockInitiate.mockResolvedValue({ data: { token: 'legacy-token', applicantId: 'a', status: 'NOT_STARTED' } })
    const result = await startWithUnreadablePlan()
    expect(result.current.showWrapper).toBe(true)
    expect(result.current.error).toBeFalsy()
})

it('a plan that cannot be read sends a Smart Paperwork Verification user to /verify, as the API asks', async () => {
    mockInitiate.mockResolvedValue({
        error: 'paperwork_verification_required',
        code: 'paperwork_verification_required',
    } as never)
    const result = await startWithUnreadablePlan()
    expect(mockRouterPush).toHaveBeenCalledWith('/verify')
    expect(result.current.showWrapper).toBe(false)
})
