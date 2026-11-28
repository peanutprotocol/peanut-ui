jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

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
    expect(mockInitiate).not.toHaveBeenCalled()
    return result
}

it('an unreadable plan opens verification recovery without dispatching legacy initiation', async () => {
    const result = await startWithUnreadablePlan()
    expect(mockRouterPush).toHaveBeenCalledWith('/verify')
    expect(result.current.showWrapper).toBe(false)
})

it('consumes a saved legacy level before routing its unsubmitted identity to /verify', async () => {
    mockFetch.mockImplementation(
        async (path) =>
            ({
                ok: true,
                status: 200,
                json: async () =>
                    path === '/users/kyc/plan'
                        ? { available: true, flow: 'verify-once', routes: [] }
                        : { identity: null },
            }) as Response
    )
    const consume = jest.fn(async () => {
        expect(mockRouterPush).not.toHaveBeenCalled()
    })
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        await result.current.handleInitiateKyc(
            'EU',
            'bridge-requirements',
            undefined,
            undefined,
            false,
            undefined,
            false,
            consume
        )
    })
    expect(consume).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).toHaveBeenCalledWith('/verify')
    expect(mockInitiate).not.toHaveBeenCalled()
})
