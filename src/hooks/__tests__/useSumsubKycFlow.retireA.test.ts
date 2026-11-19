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

it.each([
    ['network failure', undefined],
    ['empty response', null],
    ['missing availability', {}],
    ['malformed availability', { available: 'no', routes: [] }],
    ['unknown plan flow', { available: true, flow: 'unknown', routes: [] }],
    ['verify-once plan', { available: true, flow: 'verify-once', routes: [] }],
] as const)('prevents a fresh legacy applicant for %s', async (_title, plan) => {
    if (plan === undefined) {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    } else {
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => plan } as Response)
    }
    mockInitiate.mockResolvedValue({ data: { token: 'legacy-token', applicantId: 'a', status: 'NOT_STARTED' } })
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        const start = result.current.handleInitiateKyc('EU')
        await jest.runAllTimersAsync()
        await start
    })
    expect(mockInitiate).not.toHaveBeenCalled()
    expect(result.current.showWrapper).toBe(false)
    if (plan && 'flow' in plan && plan.flow === 'verify-once') {
        expect(mockRouterPush).toHaveBeenCalledWith('/verify')
    }
})

const existingIdentityPlan = { available: false, flow: null, routes: [] }

const startExistingFollowUp = async (status: number, response: object) => {
    mockInitiate.mockImplementation(jest.requireActual('@/app/actions/sumsub').initiateSumsubKyc)
    mockFetch.mockImplementation(async (path) => {
        const isStart = path === '/users/identity'
        return {
            ok: isStart ? status === 200 : true,
            status: isStart ? status : 200,
            json: async () => (isStart ? response : existingIdentityPlan),
        } as Response
    })
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        const start = result.current.handleInitiateKyc('EU', 'follow-up')
        await jest.runAllTimersAsync()
        await start
    })
    expect(mockFetch).toHaveBeenCalledWith('/users/identity', expect.anything())
    return result.current
}

it('opens the existing legacy follow-up with its token', async () => {
    const flow = await startExistingFollowUp(200, {
        token: 'follow-up-token',
        applicantId: 'existing',
        status: 'NOT_STARTED',
    })
    expect(flow.showWrapper).toBe(true)
    expect(flow.accessToken).toBe('follow-up-token')
    expect(mockRouterPush).not.toHaveBeenCalledWith('/verify')
})

it('routes a legacy follow-up to /verify when the API responds with the paperwork conflict', async () => {
    const flow = await startExistingFollowUp(409, { code: 'paperwork_verification_required' })
    expect(mockRouterPush).toHaveBeenCalledWith('/verify')
    expect(flow.showWrapper).toBe(false)
})

it('shows the update message supplied by the API', async () => {
    const userMessage = 'Update Peanut to continue verification.'
    const flow = await startExistingFollowUp(409, { code: 'kyc_client_update_required', userMessage })
    expect(flow.error).toBe(userMessage)
    expect(flow.showWrapper).toBe(false)
})
