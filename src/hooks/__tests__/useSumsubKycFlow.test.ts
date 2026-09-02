import { act, waitFor } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import {
    initiateSumsubKyc,
    initiateSelfHealResubmission,
    restartIdentityVerification,
    startKycAction,
} from '@/app/actions/sumsub'

// useSumsubKycFlow wires a websocket, redux, the router and three server actions.
// Stub everything except the one action the cross-region branch reads so the test
// asserts hook behaviour (does onKycSuccess fire? is an error surfaced?) and nothing else.
// The websocket mock captures the status-update handler so a test can simulate a
// late/stale APPROVED event arriving after the flow has resolved.

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    // Only the network-touching actions are stubbed. Pure helpers like
    // isTerminalActionCode come from the real module: they encode which
    // refusals are permanent, and a stub would let the hook's terminal
    // branch pass a test while doing nothing in production.
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
jest.mock('@/redux/hooks', () => ({ useUserStore: () => ({ user: { user: { username: 'test' } } }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>
const mockResubmit = initiateSelfHealResubmission as jest.MockedFunction<typeof initiateSelfHealResubmission>
const mockStartAction = startKycAction as jest.MockedFunction<typeof startKycAction>
const mockRestart = restartIdentityVerification as jest.MockedFunction<typeof restartIdentityVerification>

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

    // The P1 soft-lock. One payload-build failure marks all four Bridge rails
    // FAILED at once, and nothing in the product re-enables them. The BE used to
    // answer with a bare approved+null-token body — identical on the wire to
    // "you're done" — so the hook fired onKycSuccess and the user saw nothing at
    // all when they pressed Verify. Support then told them to press it again
    // (TASK-21882).
    it('rails-unavailable → surfaces an error and does NOT fire onKycSuccess', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: null, applicantId: 'app_1', status: 'APPROVED', actionType: 'rails-unavailable' },
        })
        const onKycSuccess = jest.fn()

        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('EU', undefined, true)
        })

        expect(result.current.error).toBeTruthy()
        expect(result.current.showWrapper).toBe(false)
        // The flag consumers gate their retry CTA on. Without it UnlockedRegions
        // decides retriability from the region alone — and EU/NA both HAVE a
        // provider, so the futile "Try again" came straight back.
        expect(result.current.isTerminalError).toBe(true)
        await waitFor(() => expect(onKycSuccess).not.toHaveBeenCalled())
    })

    // A backend refusal that explains itself must reach the user intact. The
    // generic catalog copy would say "verification couldn't start" over the top
    // of "not available for US citizens", which is strictly less useful and
    // makes a permanent restriction look like a transient hiccup.
    it('a backend explanation survives instead of being replaced by generic retry copy', async () => {
        mockInitiate.mockResolvedValue({
            error: 'Payments from this country are not available for US citizens at this time.',
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true)
        })

        expect(result.current.error).toMatch(/US citizens/i)
    })

    // The paired backend refuses a LATAM action it cannot name a country for —
    // and the regions screen offers LATAM as one bucket, so it has none to send
    // and the backend has already tried the user's residence. Retrying repeats
    // the identical request, so it must not look retriable.
    it('target_country_required is terminal, not a retry loop', async () => {
        mockInitiate.mockResolvedValue({
            error: 'Bank transfers are not available for your country yet.',
            code: 'target_country_required',
        })
        const onKycSuccess = jest.fn()

        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true)
        })

        expect(result.current.isTerminalError).toBe(true)
        // the backend's own message survives — it names the actual problem
        expect(result.current.error).toMatch(/not available for your country/i)
        expect(result.current.showWrapper).toBe(false)
        await waitFor(() => expect(onKycSuccess).not.toHaveBeenCalled())
    })

    // The other side of the same branch: a genuinely finished user must still be
    // treated as finished, or the fix above turns every approval into an error.
    it('approved with no token and no actionType is still success', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: null, applicantId: 'app_1', status: 'APPROVED' },
        })
        const onKycSuccess = jest.fn()

        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('EU', undefined, true)
        })

        expect(result.current.error).toBeFalsy()
        await waitFor(() => expect(onKycSuccess).toHaveBeenCalled())
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

// Sumsub's `bridge-requirements` workflow branches every EEA applicant to the
// `bridge-eea-uplift` questionnaire right after the documents go GREEN. The SDK
// therefore has a SECOND level to show, exactly like LATAM's Manteca
// questionnaire, and must not be closed on the first submit. `isMultiLevel` is
// the flag that keeps it open (SumsubKycWrapper early-returns on it), so it has
// to be true for the intent the SDK was actually opened with.
describe('useSumsubKycFlow — multi-level workflows', () => {
    beforeEach(() => {
        mockInitiate.mockReset()
        mockWs.handler = undefined
        mockInitiate.mockResolvedValue({ data: { token: 'tok_1', applicantId: 'app_1', status: 'PENDING' } })
    })

    // The intent reaches the hook as a call-time override at almost every entry
    // point (the bank / claim / add-money flows deliberately withhold the
    // `regionIntent` prop so mounting the page does not create a backend record).
    // Deriving multi-level from the prop alone made the flag false for all of
    // them — the EEA questionnaire never got shown.
    // NA shares the `bridge-requirements` workflow with EU but is deliberately
    // NOT multi-level: its second levels are rare organic branches
    // (source-of-funds, proof-of-address), and marking NA multi-level would park
    // every US applicant in an open SDK until approval to serve them.
    it.each([
        ['EU', true],
        ['LATAM', true],
        ['NA', false],
        ['ROW', false],
        ['STANDARD', false],
    ] as const)('intent %s passed as a call-time override → isMultiLevel %s', async (intent, expected) => {
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc(intent)
        })

        expect(result.current.showWrapper).toBe(true)
        expect(result.current.isMultiLevel).toBe(expected)
    })

    it('falls back to the regionIntent prop when no override is passed', async () => {
        const { result } = renderHook(() => useSumsubKycFlow({ regionIntent: 'EU' }))

        await act(async () => {
            await result.current.handleInitiateKyc()
        })

        expect(result.current.isMultiLevel).toBe(true)
    })

    // A residence change re-opens identity through restart-identity with the
    // NEW residence's intent; the hook prop only catches up on the next render,
    // so the intent travels with the call and the second level must still run.
    it('a residence re-verification carries its intent into the restart and stays multi-level', async () => {
        mockRestart.mockResolvedValue({ data: { token: 'tok_restart', applicantId: 'app_1', levelName: 'general' } })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleRestartIdentity('LATAM')
        })

        expect(mockRestart).toHaveBeenCalledWith('LATAM')
        expect(result.current.showWrapper).toBe(true)
        expect(result.current.isMultiLevel).toBe(true)
    })

    // The backend derives the intent from the declared residence when the caller
    // names none (the Manteca CTAs), and can overrule one that contradicts it.
    // `levelName` cannot stand in: EU and NA share `bridge-requirements`, LATAM
    // and ROW share `general`, and only EU and LATAM run a second level.
    it('takes the multi-level shape from the intent the backend resolved', async () => {
        mockRestart.mockResolvedValue({
            data: { token: 'tok_restart', applicantId: 'app_1', levelName: 'general', regionIntent: 'LATAM' },
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleRestartIdentity()
        })

        expect(mockRestart).toHaveBeenCalledWith(undefined)
        expect(result.current.isMultiLevel).toBe(true)
    })

    it('a resolved ROW intent stays single-level even though it shares a level with LATAM', async () => {
        mockRestart.mockResolvedValue({
            data: { token: 'tok_restart', applicantId: 'app_1', levelName: 'general', regionIntent: 'ROW' },
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleRestartIdentity('LATAM')
        })

        expect(result.current.isMultiLevel).toBe(false)
    })

    // An applicant action is a single level whatever the region — cross-region
    // LATAM mints a `manteca` action token, so it must still close on submit.
    // Every path that closes the SDK must clear the flag, or a later single-level
    // open (self-heal, restart-identity, start-action) inherits a stale true and
    // SumsubKycWrapper suppresses its completion close — stranding the user in the
    // SDK. Approval is the one close path that does not run a close handler.
    it('clears isMultiLevel when approval closes the SDK', async () => {
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('EU')
        })
        expect(result.current.isMultiLevel).toBe(true)

        await act(async () => {
            mockWs.handler?.('APPROVED')
        })

        expect(result.current.showWrapper).toBe(false)
        expect(result.current.isMultiLevel).toBe(false)
    })

    it('an applicant action is single-level even for a multi-level intent', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: 'tok_1', applicantId: 'app_1', status: 'APPROVED', actionType: 'manteca' },
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })

        expect(result.current.isActionFlow).toBe(true)
        expect(result.current.isMultiLevel).toBe(false)
    })

    // Cross-region EU uplift is NOT an applicant action: the backend moves the
    // applicant to bridge-requirements, whose EEA branch is the
    // bridge-eea-uplift questionnaire — the SDK must hold open through it.
    it('cross-region EU uplift (bridge-uplift) stays multi-level', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: 'tok_1', applicantId: 'app_1', status: 'APPROVED', actionType: 'bridge-uplift' },
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('EU', undefined, true, 'DE')
        })

        expect(result.current.isActionFlow).toBe(false)
        expect(result.current.isMultiLevel).toBe(true)
    })

    it('bridge-uplift toward NA keeps NA single-level', async () => {
        mockInitiate.mockResolvedValue({
            data: { token: 'tok_1', applicantId: 'app_1', status: 'APPROVED', actionType: 'bridge-uplift' },
        })
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('NA', undefined, true, 'US')
        })

        expect(result.current.isActionFlow).toBe(false)
        expect(result.current.isMultiLevel).toBe(false)
    })
})

// The companion backend change maps the follow-up level's `init` state to
// ACTION_REQUIRED, which now lands ~3 min after the documents are submitted —
// while the user is still filling the questionnaire in the open SDK. The
// status-transition effect must not tear the flow down under them.
describe('useSumsubKycFlow — ACTION_REQUIRED during a multi-level session', () => {
    beforeEach(() => {
        mockInitiate.mockReset()
        mockWs.handler = undefined
        mockInitiate.mockResolvedValue({ data: { token: 'tok_1', applicantId: 'app_1', status: 'PENDING' } })
    })

    // Reaches the both-open state the guard protects: the user submitted once
    // (progress modal up), then re-initiated from another entry point, so the
    // SDK is open again on top of it.
    const openSdkOverProgressModal = async (intent: 'EU' | 'ROW') => {
        const view = renderHook(() => useSumsubKycFlow({}))
        act(() => {
            view.result.current.handleSdkComplete()
        })
        await act(async () => {
            await view.result.current.handleInitiateKyc(intent)
        })
        expect(view.result.current.showWrapper).toBe(true)
        expect(view.result.current.isVerificationProgressModalOpen).toBe(true)
        return view
    }

    it('holds the flow open while the SDK shows the questionnaire', async () => {
        const { result } = await openSdkOverProgressModal('EU')

        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })

        expect(result.current.isVerificationProgressModalOpen).toBe(true)
    })

    // The suppression must DEFER the transition, not consume it. prevStatusRef is
    // left alone while the SDK is open, so closing the SDK re-runs the effect and
    // the transition is evaluated for real. If the ref were advanced during the
    // suppressed pass, a user who abandoned mid-questionnaire would be stranded on
    // a stale "verifying" modal with nothing left to close it.
    it('re-evaluates the deferred transition once the SDK closes', async () => {
        const { result } = await openSdkOverProgressModal('EU')

        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })
        expect(result.current.isVerificationProgressModalOpen).toBe(true)

        // user abandons the questionnaire — no new status event follows
        act(() => {
            result.current.handleClose()
        })

        expect(result.current.showWrapper).toBe(false)
        expect(result.current.isVerificationProgressModalOpen).toBe(false)
    })

    // …EXCEPT when the close is a submission. An in-session resubmit after a RED
    // decline runs handleSdkComplete, which opens the progress modal — replaying
    // the held (now stale) transition would close it in the same breath and dump
    // the user on an ACTION_REQUIRED drawer for documents they just resubmitted.
    // handleSdkComplete consumes the deferred status instead.
    it('a submission close consumes the deferred transition — the progress modal stays open', async () => {
        const { result } = await openSdkOverProgressModal('EU')

        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })
        expect(result.current.isVerificationProgressModalOpen).toBe(true)

        // in-session resubmit: onApplicantResubmitted → handleSdkComplete
        act(() => {
            result.current.handleSdkComplete()
        })

        expect(result.current.showWrapper).toBe(false)
        expect(result.current.isVerificationProgressModalOpen).toBe(true)
    })

    // The counterpart: a MANUAL close always replays. handleSdkComplete is the
    // only close that can honestly claim a submission — the wrapper cannot tell
    // "submitted the required follow-up" from "submitted level 1 and walked
    // away" (a second onApplicantSubmitted is deduped as the idCheck twin, not
    // read as a new level), so a close that consumed on its say-so would swallow
    // a real ACTION_REQUIRED and leave the user on a stale progress modal.
    it('a manual close replays the deferred transition', async () => {
        const { result } = await openSdkOverProgressModal('EU')

        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })
        expect(result.current.isVerificationProgressModalOpen).toBe(true)

        act(() => {
            result.current.handleClose()
        })

        expect(result.current.showWrapper).toBe(false)
        expect(result.current.isVerificationProgressModalOpen).toBe(false)
    })

    // Boundary: the suppression is scoped to an OPEN SDK. Once the user is out of
    // the SDK, ACTION_REQUIRED is a real drawer state and must close the modal.
    it('still closes once the SDK is closed', async () => {
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('EU')
        })
        expect(result.current.isMultiLevel).toBe(true)

        act(() => {
            result.current.handleSdkComplete()
        })
        expect(result.current.showWrapper).toBe(false)

        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })

        expect(result.current.isVerificationProgressModalOpen).toBe(false)
    })

    // Boundary: the suppression is scoped to ACTION_REQUIRED. A rejection is
    // terminal and must still close, SDK open or not.
    it('REJECTED still closes the modal with the SDK open', async () => {
        const { result } = await openSdkOverProgressModal('EU')

        await act(async () => {
            mockWs.handler?.('REJECTED')
        })

        expect(result.current.isVerificationProgressModalOpen).toBe(false)
    })

    // Boundary: the suppression is scoped to multi-level flows. A single-level
    // ROW session gets the unchanged close.
    it('a single-level session still closes on ACTION_REQUIRED', async () => {
        const { result } = await openSdkOverProgressModal('ROW')
        expect(result.current.isMultiLevel).toBe(false)

        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })

        expect(result.current.isVerificationProgressModalOpen).toBe(false)
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

// Regression for the post-KYC "upload document" loop on Manteca (add-money
// Bolivia/Argentina, 2026-08). A Manteca RFI (source of funds, PEP/FEP) is
// its own Sumsub level carried as a `sumsub:*` nextAction; the legacy resubmit
// route only ever mints the generic ID-reupload action, which Sumsub opens on
// "your profile is verified" → nothing submitted → same modal on the next tap.
describe('useSumsubKycFlow — handleFixableRejection routing', () => {
    beforeEach(() => {
        mockInitiate.mockReset()
        mockResubmit.mockReset()
        mockStartAction.mockReset()
        mockWs.handler = undefined
    })

    it('MANTECA + sumsub action key → start-action for that level, never the generic resubmit', async () => {
        mockStartAction.mockResolvedValue({ data: { token: 'tok-sof', levelName: 'provider-rfi-source-of-funds' } })
        const { result } = renderHook(() => useSumsubKycFlow())

        await act(async () => {
            await result.current.handleFixableRejection({ provider: 'MANTECA', actionKey: 'sumsub:source_of_funds' })
        })

        expect(mockStartAction).toHaveBeenCalledWith('sumsub:source_of_funds')
        expect(mockResubmit).not.toHaveBeenCalled()
        expect(result.current.accessToken).toBe('tok-sof')
        expect(result.current.showWrapper).toBe(true)
        expect(result.current.isActionFlow).toBe(true)
    })

    it('MANTECA without an action key → legacy resubmit (generic ID re-upload)', async () => {
        mockResubmit.mockResolvedValue({ data: { token: 'tok-reupload' } } as never)
        const { result } = renderHook(() => useSumsubKycFlow())

        await act(async () => {
            await result.current.handleFixableRejection({ provider: 'MANTECA', actionKey: null })
        })

        expect(mockResubmit).toHaveBeenCalledWith('MANTECA', undefined)
        expect(mockStartAction).not.toHaveBeenCalled()
        expect(result.current.accessToken).toBe('tok-reupload')
    })

    it('BRIDGE keeps the resubmit route even when a sumsub action key exists', async () => {
        mockResubmit.mockResolvedValue({ data: { token: 'tok-bridge' } } as never)
        const { result } = renderHook(() => useSumsubKycFlow())

        await act(async () => {
            await result.current.handleFixableRejection({ provider: 'BRIDGE', actionKey: 'sumsub:proof_of_address' })
        })

        expect(mockResubmit).toHaveBeenCalledWith('BRIDGE', undefined)
        expect(mockStartAction).not.toHaveBeenCalled()
    })

    it('start-action failure surfaces an error and does not open the SDK', async () => {
        mockStartAction.mockResolvedValue({ error: 'Action not allowed for this user' })
        const { result } = renderHook(() => useSumsubKycFlow())

        await act(async () => {
            await result.current.handleFixableRejection({ provider: 'MANTECA', actionKey: 'sumsub:source_of_funds' })
        })

        expect(result.current.error).toBe('Action not allowed for this user')
        expect(result.current.showWrapper).toBe(false)
    })

    // The WebSDK refreshes mid-upload once the token TTL lapses. POST /users/identity
    // ignores levelName and no-ops for an already-approved user — exactly who an RFI
    // targets — so falling through to it killed the SDK mid-RFI.
    it('refreshToken re-mints an RFI token through start-action, not POST /users/identity', async () => {
        mockStartAction
            .mockResolvedValueOnce({ data: { token: 'tok-sof', levelName: 'provider-rfi-source-of-funds' } })
            .mockResolvedValueOnce({ data: { token: 'tok-sof-refreshed', levelName: 'provider-rfi-source-of-funds' } })
        const { result } = renderHook(() => useSumsubKycFlow())

        await act(async () => {
            await result.current.handleFixableRejection({ provider: 'MANTECA', actionKey: 'sumsub:source_of_funds' })
        })

        let refreshed: string | undefined
        await act(async () => {
            refreshed = await result.current.refreshToken()
        })

        expect(refreshed).toBe('tok-sof-refreshed')
        expect(mockStartAction).toHaveBeenLastCalledWith('sumsub:source_of_funds')
        expect(mockStartAction).toHaveBeenCalledTimes(2)
        expect(mockInitiate).not.toHaveBeenCalled()
        expect(mockResubmit).not.toHaveBeenCalled()
    })

    it('a self-heal resubmit after an RFI refreshes through resubmit, not the stale action key', async () => {
        mockStartAction.mockResolvedValue({ data: { token: 'tok-sof', levelName: 'provider-rfi-source-of-funds' } })
        mockResubmit.mockResolvedValue({ data: { token: 'tok-bridge' } } as never)
        const { result } = renderHook(() => useSumsubKycFlow())

        await act(async () => {
            await result.current.handleFixableRejection({ provider: 'MANTECA', actionKey: 'sumsub:source_of_funds' })
        })
        await act(async () => {
            await result.current.handleFixableRejection({ provider: 'BRIDGE', actionKey: null })
        })

        await act(async () => {
            await result.current.refreshToken()
        })

        expect(mockResubmit).toHaveBeenLastCalledWith('BRIDGE')
        expect(mockStartAction).toHaveBeenCalledTimes(1)
    })
})
