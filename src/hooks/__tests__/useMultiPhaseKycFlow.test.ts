import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import posthog from 'posthog-js'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

// Pins the KYC_REJECTED capture + user-store refresh effect: it must be
// edge-triggered on the status (its other deps churn during resubmit rounds)
// and honor the multi-level deferral's consume-on-submission semantics.

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
const mockFetchUser = jest.fn()

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    // Only the network-touching actions are stubbed — pure helpers like
    // isTerminalActionCode must come from the real module, or the hook's
    // terminal-refusal branch calls undefined and every initiate bails.
    initiateSumsubKyc: jest.fn(),
    initiateSelfHealResubmission: jest.fn(),
    restartIdentityVerification: jest.fn(),
    startKycAction: jest.fn(),
}))
jest.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: (opts: { onSumsubKycStatusUpdate?: (status: string, labels?: string[]) => void }) => {
        mockWs.handler = opts.onSumsubKycStatusUpdate
    },
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isAndroidNative: () => false }))
// the transitive useSumsubKycFlow reads user.user.username off the same useAuth
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser, user: { user: { username: 'test' } } }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: undefined }) }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/utils/capability-gate', () => ({ deriveGate: () => ({ kind: 'none' }) }))
jest.mock('@/app/actions/users', () => ({ getBridgeTosLink: jest.fn(), confirmBridgeTos: jest.fn() }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>
const mockCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>

const rejectedCaptures = () => mockCapture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.KYC_REJECTED)

describe('useMultiPhaseKycFlow — KYC_REJECTED capture effect', () => {
    beforeEach(() => {
        mockInitiate.mockReset()
        mockCapture.mockClear()
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(null)
        mockWs.handler = undefined
    })

    it('captures once per status transition and refreshes the user store once', async () => {
        renderHook(() => useMultiPhaseKycFlow({}))

        await act(async () => {
            mockWs.handler?.('REJECTED')
        })

        expect(rejectedCaptures()).toHaveLength(1)
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    // Regression: the effect's deps include showWrapper, which toggles when the
    // user re-opens the SDK to resubmit while the status is still the stale
    // REJECTED. The non-edge-triggered version fired a duplicate KYC_REJECTED
    // and 2-3 redundant fetchUser calls per resubmit round.
    it('a resubmit round (SDK reopen + close on a stale status) does not duplicate the capture', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: 'tok_1', applicantId: 'app_1', status: 'REJECTED' },
        })
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))

        await act(async () => {
            mockWs.handler?.('REJECTED')
        })
        expect(rejectedCaptures()).toHaveLength(1)
        expect(mockFetchUser).toHaveBeenCalledTimes(1)

        // reopen the SDK (showWrapper flips true — effect deps change, status doesn't)
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        expect(result.current.showWrapper).toBe(true)

        // manual close (showWrapper flips back)
        act(() => {
            result.current.handleSdkClose()
        })

        expect(rejectedCaptures()).toHaveLength(1)
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    describe('multi-level deferral', () => {
        const openMultiLevelSdk = async () => {
            mockInitiate.mockResolvedValue({
                data: { token: 'tok_1', applicantId: 'app_1', status: 'PENDING' },
            })
            const view = renderHook(() => useMultiPhaseKycFlow({}))
            await act(async () => {
                await view.result.current.handleInitiateKyc('EU')
            })
            expect(view.result.current.showWrapper).toBe(true)
            expect(view.result.current.isMultiLevel).toBe(true)
            return view
        }

        it('defers ACTION_REQUIRED while the SDK is open, then captures once on an abandoned close', async () => {
            const { result } = await openMultiLevelSdk()

            await act(async () => {
                mockWs.handler?.('ACTION_REQUIRED')
            })
            // deferred: the questionnaire is showing, not a rejection
            expect(rejectedCaptures()).toHaveLength(0)

            act(() => {
                result.current.handleSdkClose()
            })

            // abandoning really does leave the action required — replay fires once
            expect(rejectedCaptures()).toHaveLength(1)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
        })

        // A manual close ALWAYS replays, even after a submit. The wrapper cannot
        // tell "submitted the required follow-up" from "submitted level 1 and
        // walked away" — a second onApplicantSubmitted is deduped as the idCheck
        // twin, not read as a new level — so trusting it would swallow a real
        // ACTION_REQUIRED and strand the user on a stale progress modal.
        // handleSdkComplete below is the one close that legitimately consumes.
        it('a manual close still replays, even when the user had already submitted a level', async () => {
            const { result } = await openMultiLevelSdk()

            act(() => {
                result.current.handleSdkSubmitted()
            })
            await act(async () => {
                mockWs.handler?.('ACTION_REQUIRED')
            })
            expect(rejectedCaptures()).toHaveLength(0)

            act(() => {
                result.current.handleSdkClose()
            })

            expect(rejectedCaptures()).toHaveLength(1)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
        })

        // handleSdkComplete does not consume it either. On native the callback is
        // ambiguous in a multi-level session: SumsubNativeSdk puts Pending in
        // SUBMITTED_STATES, so a Level-1 submit followed by backing out of Level 2
        // resolves launch() as Initial but still fires onComplete — identical to a
        // real completion from here. Consuming on that path suppressed the capture
        // and the user-store refresh and left a stale progress modal.
        it('a handleSdkComplete close still captures — the native Level-1 exit looks the same', async () => {
            const { result } = await openMultiLevelSdk()

            await act(async () => {
                mockWs.handler?.('ACTION_REQUIRED')
            })
            expect(rejectedCaptures()).toHaveLength(0)

            act(() => {
                result.current.handleSdkComplete()
            })

            expect(rejectedCaptures()).toHaveLength(1)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
        })
    })
})
