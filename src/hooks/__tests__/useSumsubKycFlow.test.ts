import { act, renderHook, waitFor } from '@testing-library/react'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'

// useSumsubKycFlow wires a websocket, redux, the router and three server actions.
// Stub everything except the one action the cross-region branch reads so the test
// asserts hook behaviour (does onKycSuccess fire? is an error surfaced?) and nothing else.
// The websocket mock captures the status-update handler so a test can simulate a
// late/stale APPROVED event arriving after the flow has resolved.
const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
jest.mock('@/app/actions/sumsub', () => ({
    initiateSumsubKyc: jest.fn(),
    initiateSelfHealResubmission: jest.fn(),
    restartIdentityVerification: jest.fn(),
}))
jest.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: (opts: { onSumsubKycStatusUpdate?: (status: string, labels?: string[]) => void }) => {
        mockWs.handler = opts.onSumsubKycStatusUpdate
    },
}))
jest.mock('@/redux/hooks', () => ({ useUserStore: () => ({ user: { user: { username: 'test' } } }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>

describe('useSumsubKycFlow — cross-region routing', () => {
    beforeEach(() => {
        mockInitiate.mockReset()
        mockWs.handler = undefined
    })

    // Regression for the "Unlock {region}" no-op loop (ROW). The BE approves identity
    // but can't enroll any first-party bank rail for rest-of-world, so it returns
    // actionType: 'unsupported-region' (status APPROVED, no token). The hook MUST show
    // an honest message and MUST NOT fire onKycSuccess — firing it loops the user back
    // through the "all set" success path with nothing actually unlocked.
    it('unsupported-region → surfaces an honest error and does NOT fire onKycSuccess', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: null, applicantId: 'app_1', status: 'APPROVED', actionType: 'unsupported-region' },
        })
        const onKycSuccess = jest.fn()

        // regionIntent undefined → the mount-time status fetch short-circuits, so the
        // only initiateSumsubKyc call is the one handleInitiateKyc drives below.
        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('ROW', undefined, true)
        })

        expect(result.current.error).toMatch(/region/i)
        expect(result.current.showWrapper).toBe(false)
        // give any queued status-transition effect a chance to (wrongly) fire.
        await waitFor(() => expect(onKycSuccess).not.toHaveBeenCalled())
    })

    // The race the loop-fix has to survive: the user is already APPROVED, so a stale /
    // connect-time websocket APPROVED event can land AFTER the unsupported-region error.
    // If the branch left userInitiatedRef set, that event trips the status-transition
    // effect into firing onKycSuccess — re-opening "all set" on top of the error.
    it('unsupported-region → stale websocket APPROVED after the error still does NOT fire onKycSuccess', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: null, applicantId: 'app_1', status: 'APPROVED', actionType: 'unsupported-region' },
        })
        const onKycSuccess = jest.fn()

        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('ROW', undefined, true)
        })
        expect(result.current.error).toMatch(/region/i)

        // simulate a late websocket status push (APPROVED) arriving after the terminal error
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })

        await waitFor(() => expect(onKycSuccess).not.toHaveBeenCalled())
    })

    // Control: the sibling cross-region success path must still fire onKycSuccess and
    // stay error-free — proves the new branch was inserted without breaking bridge-direct.
    it('bridge-direct → fires onKycSuccess with no error', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: null, applicantId: 'app_2', status: 'APPROVED', actionType: 'bridge-direct' },
        })
        const onKycSuccess = jest.fn()

        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('EU', undefined, true)
        })

        expect(result.current.error).toBeNull()
        await waitFor(() => expect(onKycSuccess).toHaveBeenCalledTimes(1))
    })
})
