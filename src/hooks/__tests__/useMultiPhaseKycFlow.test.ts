import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import posthog from 'posthog-js'
import { deriveCapabilityPhaseSignals, useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { getVerificationSession, refreshVerificationSession, initiateSumsubKyc } from '@/app/actions/sumsub'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
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
    getVerificationSession: jest.fn(),
    refreshVerificationSession: jest.fn(),
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

describe('deposit session regression contracts', () => {
    const session = (state: 'COLLECTING' | 'SUBMISSION_PENDING' | 'CORRECTION_REQUIRED' | 'READY', generation = 0) => ({
        id: 'session-1',
        generation,
        state,
        reasonCode: state === 'CORRECTION_REQUIRED' ? 'INVALID_TAX_ID' : null,
        targetCountry: 'AR',
        externalActionId: `manteca-user-${generation}-AR`,
        isMultiLevel: false,
    })
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        mockInitiate.mockReset()
        ;(getVerificationSession as jest.Mock).mockResolvedValue(session('SUBMISSION_PENDING'))
        mockFetchUser.mockResolvedValue(null)
    })
    afterEach(() => jest.useRealTimers())
    it('accepted documents wait via read-only progress, ignore base APPROVED and complete only once READY', async () => {
        mockInitiate.mockResolvedValue({
            data: {
                token: null,
                applicantId: 'app',
                status: 'IN_REVIEW',
                actionType: 'manteca',
                session: session('SUBMISSION_PENDING'),
            },
        })
        const success = jest.fn()
        const { result } = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess: success }))
        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })
        await act(async () => {
            mockWs.handler?.('APPROVED')
            await jest.advanceTimersByTimeAsync(12000)
        })
        expect(success).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(false)
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(getVerificationSession).toHaveBeenCalledWith('session-1')
        ;(getVerificationSession as jest.Mock).mockResolvedValue(session('READY'))
        await act(async () => {
            await jest.advanceTimersByTimeAsync(4000)
        })
        // READY is necessary but the downstream capability snapshot must catch up.
        expect(success).not.toHaveBeenCalled()
        expect(markSubmitted).toHaveBeenCalled()
        expect(mockFetchUser).toHaveBeenCalled()
        const refreshed = {
            capabilities: {
                rails: [
                    {
                        provider: 'manteca',
                        channel: 'bank',
                        country: 'AR',
                        currency: 'ARS',
                        status: 'enabled',
                        operations: { deposit: 'enabled' },
                    },
                ],
                nextActions: [],
                restrictions: [],
            },
        }
        mockFetchUser.mockResolvedValue(refreshed)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(4000)
        })
        expect(deriveCapabilityPhaseSignals(refreshed.capabilities as never, 'LATAM', 'AR').allSettled).toBe(true)
        expect(success).toHaveBeenCalledTimes(1)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(8000)
        })
        expect(success).toHaveBeenCalledTimes(1)
    })
    it('correction is explicit and retains the target country', async () => {
        mockInitiate.mockResolvedValueOnce({
            error: 'correct data',
            data: { token: null, applicantId: 'app', status: 'IN_REVIEW', session: session('CORRECTION_REQUIRED') },
        })
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })
        expect(result.current.showCorrection).toBe(true)
        expect(result.current.showWrapper).toBe(false)
        mockInitiate.mockResolvedValueOnce({
            data: {
                token: 'new-token',
                applicantId: 'app',
                status: 'APPROVED',
                actionType: 'manteca',
                session: session('COLLECTING', 1),
            },
        })
        await act(async () => {
            await result.current.correctVerificationData()
        })
        expect(mockInitiate).toHaveBeenLastCalledWith(
            expect.objectContaining({ regionIntent: 'LATAM', targetCountry: 'AR', correctSession: true })
        )
        expect(result.current.showWrapper).toBe(true)
        ;(refreshVerificationSession as jest.Mock).mockResolvedValue('refreshed')
        await act(async () => {
            expect(await result.current.refreshToken()).toBe('refreshed')
        })
        expect(refreshVerificationSession).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'session-1', generation: 1 })
        )
        expect(mockInitiate).toHaveBeenCalledTimes(2)
    })
    it('a generic drawer resume uses the server workflow descriptor', async () => {
        mockInitiate.mockResolvedValue({
            data: {
                token: 'workflow-token',
                applicantId: 'app',
                status: 'PENDING',
                workflow: { regionIntent: 'EU', isMultiLevel: true },
            },
        })
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc()
        })
        expect(result.current.isMultiLevel).toBe(true)
        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })
        expect(result.current.showWrapper).toBe(true)
    })
    it('skipping terms is dismissal, never successful verification', () => {
        const success = jest.fn()
        const { result } = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess: success }))
        act(() => result.current.handleSkipTerms())
        expect(success).not.toHaveBeenCalled()
    })
    it.each(['blocked', 'requires-info', 'unavailable', 'pending'])(
        'a %s deposit rail cannot be success even when QR is enabled',
        (status) => {
            const capabilities = {
                rails: [
                    { provider: 'bridge', channel: 'bank', country: 'EU', currency: 'EUR', status },
                    { provider: 'manteca', channel: 'qr-only', country: 'AR', currency: 'ARS', status: 'enabled' },
                ],
                nextActions: [],
                restrictions: [],
            }
            expect(deriveCapabilityPhaseSignals(capabilities as never, 'EU').allSettled).toBe(false)
        }
    )
    it.each([
        ['GB', 'GBP', 'EU'],
        ['MX', 'MXN', 'NA'],
    ] as const)('uses the requested %s bank jurisdiction', (country, currency, intent) => {
        const capabilities = {
            rails: [{ provider: 'bridge', channel: 'bank', country, currency, status: 'enabled' }],
            nextActions: [],
            restrictions: [],
        }
        expect(deriveCapabilityPhaseSignals(capabilities as never, intent, country).allSettled).toBe(true)
        const other = {
            ...capabilities,
            rails: [
                {
                    ...capabilities.rails[0],
                    country: intent === 'EU' ? 'EU' : 'US',
                    currency: intent === 'EU' ? 'EUR' : 'USD',
                },
            ],
        }
        expect(deriveCapabilityPhaseSignals(other as never, intent, country).allSettled).toBe(false)
    })
    it('an enabled account in another country cannot complete an AR deposit flow', () => {
        const capabilities = {
            rails: [
                {
                    provider: 'manteca',
                    channel: 'bank',
                    country: 'BR',
                    currency: 'BRL',
                    status: 'enabled',
                    operations: { deposit: 'enabled' },
                },
            ],
            nextActions: [],
            restrictions: [],
        }
        expect(deriveCapabilityPhaseSignals(capabilities as never, 'LATAM', 'AR').allSettled).toBe(false)
    })
})
