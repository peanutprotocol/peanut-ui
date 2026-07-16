import React from 'react'
import { act, renderHook as rtlRenderHook, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'

// useSumsubKycFlow wires a websocket, redux, the router and three server actions.
// Stub everything except the one action the cross-region branch reads so the test
// asserts hook behaviour (does onKycSuccess fire? is an error surfaced?) and nothing else.
// The websocket mock captures the status-update handler so a test can simulate a
// late/stale APPROVED event arriving after the flow has resolved.
// the hook calls useTranslations, so it needs an intl context to render at all
const IntlWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(NextIntlClientProvider, { locale: 'en', messages: en, timeZone: 'UTC', children })
const renderHook = <T>(cb: () => T) => rtlRenderHook(cb, { wrapper: IntlWrapper })

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

describe('useSumsubKycFlow — targetCountry gating', () => {
    beforeEach(() => {
        mockInitiate.mockReset()
        mockWs.handler = undefined
    })

    // The BE only ever consumes targetCountry as a Manteca geo, and an unsupported
    // stamp poisons the verification metadata (first-write-wins). Call sites pass the
    // raw country for every `latam`-region country, so the hook is the choke point
    // that must forward AR/BR and drop everything else.
    it('forwards a Manteca-supported targetCountry (AR) to the BE', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: 'tok_1', applicantId: 'app_1', status: 'APPROVED', actionType: 'manteca' },
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })

        expect(mockInitiate).toHaveBeenCalledWith(
            expect.objectContaining({ regionIntent: 'LATAM', crossRegion: true, targetCountry: 'AR' })
        )
    })

    it('uppercases a lowercase targetCountry (br → BR) before forwarding', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: 'tok_1', applicantId: 'app_1', status: 'APPROVED', actionType: 'manteca' },
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'br')
        })

        expect(mockInitiate).toHaveBeenCalledWith(expect.objectContaining({ targetCountry: 'BR' }))
    })

    it('drops a non-Manteca targetCountry (MX) instead of stamping a poisoned geo', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: 'tok_1', applicantId: 'app_1', status: 'APPROVED', actionType: 'manteca' },
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'MX')
        })

        expect(mockInitiate).toHaveBeenCalledWith(
            expect.objectContaining({ regionIntent: 'LATAM', crossRegion: true, targetCountry: undefined })
        )
    })
})

describe('useSumsubKycFlow — terminal-error exits clear the user-initiated guard', () => {
    beforeEach(() => {
        mockInitiate.mockReset()
        mockWs.handler = undefined
    })

    // Same race the unsupported-region branch closes, on the other terminal exits:
    // restoring prevStatusRef while leaving userInitiatedRef set lets a late websocket
    // event fire onKycSuccess on top of the rendered error. The PENDING→APPROVED
    // two-event sequence isolates the userInitiatedRef guard — PENDING advances
    // prevStatusRef first, so the prevStatus !== 'APPROVED' guard alone cannot save a
    // regression that re-leaks the ref.
    it('response.error → late PENDING→APPROVED websocket events do NOT fire onKycSuccess', async () => {
        mockInitiate.mockResolvedValue({ error: 'region_not_supported' })
        const onKycSuccess = jest.fn()

        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })
        expect(result.current.error).toBe('region_not_supported')

        await act(async () => {
            mockWs.handler?.('PENDING')
        })
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })

        await waitFor(() => expect(onKycSuccess).not.toHaveBeenCalled())
    })

    it('thrown initiate → late PENDING→APPROVED websocket events do NOT fire onKycSuccess', async () => {
        mockInitiate.mockRejectedValue(new Error('network down'))
        const onKycSuccess = jest.fn()

        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('EU', undefined, true)
        })
        expect(result.current.error).toBe('network down')

        await act(async () => {
            mockWs.handler?.('PENDING')
        })
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })

        await waitFor(() => expect(onKycSuccess).not.toHaveBeenCalled())
    })

    // Control: a real flow that opens the SDK keeps the guard armed — the user
    // completing KYC afterwards must still fire onKycSuccess via the transition effect.
    it('successful SDK open keeps the guard armed: later APPROVED fires onKycSuccess', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: 'tok_1', applicantId: 'app_1', status: 'PENDING' },
        })
        const onKycSuccess = jest.fn()

        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('EU')
        })
        expect(result.current.error).toBeNull()
        expect(result.current.showWrapper).toBe(true)

        await act(async () => {
            mockWs.handler?.('APPROVED')
        })

        await waitFor(() => expect(onKycSuccess).toHaveBeenCalledTimes(1))
    })
})

// Incident 2026-07-02: while the verification-progress modal was open, this hook
// fired initiateSumsubKyc — a MUTATING endpoint — on a fixed 5s setInterval for
// the entire modal-open, re-running provider submissions for approved-LATAM
// self-recovery users (86 in 20 min for one user). The poll now backs off on a
// time-escalating schedule (5s for the first minute, then 10s → 20s → 60s) and
// then holds a steady 60s cadence for as long as the modal is open — it never
// hard-stops, so a late/missed websocket event is always eventually recovered
// (the earlier 15-min cap stranded users on "Almost there"). Backoff is
// time-based, not error-based: the poll returns HTTP 200 even when the backend
// reprocess fails.
describe('useSumsubKycFlow — verification-progress poll backoff', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockInitiate.mockReset()
        // PENDING is a keep-open status (the transition effect only closes on a
        // terminal non-APPROVED state), so the modal stays open across polls and
        // every recorded call is attributable to the poll timer.
        mockInitiate.mockResolvedValue({ data: { token: null, applicantId: 'poll', status: 'PENDING' } })
        mockWs.handler = undefined
    })
    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    // Open the modal via handleSdkComplete (the SDK-submitted path): it flips
    // isVerificationProgressModalOpen without itself calling initiateSumsubKyc.
    // regionIntent is left undefined so the mount-time status fetch short-circuits.
    const openModal = () => {
        const view = renderHook(() => useSumsubKycFlow({}))
        act(() => {
            view.result.current.handleSdkComplete()
        })
        return view
    }

    it('escalates the poll cadence 5s → 10s → 20s as the modal stays open', async () => {
        openModal()

        // setInterval-parity: nothing fires immediately, the first poll is one delay out.
        expect(mockInitiate).toHaveBeenCalledTimes(0)

        // first ~1 min: 5s cadence → 12 polls by t=60s.
        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(12)

        // the next poll is now 10s out, not 5s: +5s yields nothing, +5s more yields one.
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(12)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(13)

        // 60–120s band holds the 10s cadence → 18 polls by t=120s.
        await act(async () => {
            await jest.advanceTimersByTimeAsync(50_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(18)

        // 120–180s band escalates to 20s: +19s nothing, +1s one.
        await act(async () => {
            await jest.advanceTimersByTimeAsync(19_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(18)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(1_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(19)
    })

    it('keeps polling past 15 min (no strand) but stays bounded at the 60s steady cadence', async () => {
        openModal()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(15 * 60_000)
        })
        const countAt15m = mockInitiate.mock.calls.length
        // escalation kept the first 15 min far below a fixed-5s cadence (~180).
        expect(countAt15m).toBeGreaterThan(0)
        expect(countAt15m).toBeLessThan(40)

        // 10 more minutes at the 60s floor → ~10 further polls, NOT zero (the old
        // cap stranded the user here) and NOT a 5s-cadence flood.
        await act(async () => {
            await jest.advanceTimersByTimeAsync(10 * 60_000)
        })
        const delta = mockInitiate.mock.calls.length - countAt15m
        expect(delta).toBeGreaterThanOrEqual(8)
        expect(delta).toBeLessThanOrEqual(12)
    })

    it('a status that goes APPROVED after a long wait still surfaces (no strand)', async () => {
        const onKycSuccess = jest.fn()
        const view = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
        act(() => {
            view.result.current.handleSdkComplete()
        })

        // 20 minutes of "still pending" — well past the old 15-min cap.
        await act(async () => {
            await jest.advanceTimersByTimeAsync(20 * 60_000)
        })
        // Backend finally approves; the next poll picks it up.
        mockInitiate.mockResolvedValue({ data: { token: null, applicantId: 'poll', status: 'APPROVED' } })
        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
        })
        expect(onKycSuccess).toHaveBeenCalled()
    })

    it('cancels the pending timer when the modal closes', async () => {
        const { result } = openModal()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(1)

        act(() => {
            result.current.closeVerificationProgressModal()
        })

        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(1)
    })

    it('cancels the pending timer on unmount', async () => {
        const { unmount } = openModal()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(1)

        unmount()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(1)
    })

    it('polls initiateSumsubKyc with the same region/level/country args as before', async () => {
        openModal()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        expect(mockInitiate).toHaveBeenCalledWith({
            regionIntent: undefined,
            levelName: undefined,
            targetCountry: undefined,
        })
    })
})
