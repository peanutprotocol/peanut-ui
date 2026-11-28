import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    clearObservedFriction,
    DISMISS_COOLDOWN_MS,
    FRICTION_MEMORY_TTL_MS,
    GLOBAL_QUIET_COOLDOWN_MS,
    markSeenAddMoneyUnfunded,
    readStuckMemory,
    recordObservedFriction,
    recordSurfaceActionCooldown,
    recordSurfaceDismissal,
} from '../memory'
import {
    clearLocalVerifyFieldError,
    evaluateIdleTick,
    getStuckRuntimeSnapshot,
    markSessionNudgeShown,
    noteElementClick,
    noteLocalVerifyFieldError,
    noteUserActivity,
    resetStuckRuntimeForTests,
    SESSION_RESET_IDLE_MS,
    setDepositDetailsStepActive,
    setPasskeyStepState,
    setStuckDocumentVisible,
    setStuckFlowBusy,
    setStuckRoute,
} from '../signalStore'
import { noteStuckAnalyticsEvent } from '../signalTap'

describe('stuck-detector memory', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('persists dismissal cooldowns, global quiet period, and increments lifetime dismiss cap', () => {
        const t0 = 1_700_000_000_000
        const after1 = recordSurfaceDismissal('user-1', 'add_money', t0)
        expect(after1.dismissedUntil.add_money).toBe(t0 + DISMISS_COOLDOWN_MS)
        expect(after1.globalQuietUntil).toBe(t0 + GLOBAL_QUIET_COOLDOWN_MS)
        expect(after1.lifetimeDismissCount).toBe(1)

        const reread = readStuckMemory('user-1')
        expect(reread.lifetimeDismissCount).toBe(1)
        expect(reread.dismissedUntil.add_money).toBe(t0 + DISMISS_COOLDOWN_MS)
    })

    it('keeps home_wave cooldown isolated from globalQuietUntil so a wave never silences real payment help', () => {
        const t0 = 1_700_000_000_000
        const afterWave = recordSurfaceActionCooldown('user-wave', 'home_wave', t0)
        expect(afterWave.dismissedUntil.home_wave).toBe(t0 + DISMISS_COOLDOWN_MS)
        expect(afterWave.globalQuietUntil).toBe(0)
        expect(afterWave.lifetimeDismissCount).toBe(0)
    })

    it('stores time-bounded observed friction and clears it cleanly on activation', () => {
        const t0 = 1_700_000_000_000
        expect(readStuckMemory('user-3').priorObservedFrictionUntil).toBe(0)
        expect(recordObservedFriction('user-3', t0).priorObservedFrictionUntil).toBe(t0 + FRICTION_MEMORY_TTL_MS)
        expect(clearObservedFriction('user-3').priorObservedFrictionUntil).toBe(0)
        expect(markSeenAddMoneyUnfunded('user-3').seenAddMoneyUnfunded).toBe(true)
    })

    it('falls back cleanly on corrupted storage JSON', () => {
        window.localStorage.setItem('peanut:stuck-memory:v2:bad', '{not-json')
        const mem = readStuckMemory('bad')
        expect(mem.lifetimeDismissCount).toBe(0)
        expect(mem.priorObservedFrictionUntil).toBe(0)
    })
})

describe('stuck-detector signalStore & signalTap', () => {
    const T0 = 1_700_000_000_000

    beforeEach(() => {
        resetStuckRuntimeForTests(T0)
    })

    it('preserves full activeDwellMs even when the user taps every 3s between 5s ticks (N4)', () => {
        setStuckRoute('/add-money/germany/bank', T0)
        setDepositDetailsStepActive(true, T0)

        for (let sec = 3; sec <= 60; sec += 3) {
            noteUserActivity(T0 + sec * 1_000)
        }

        const snap = getStuckRuntimeSnapshot()
        expect(snap.activeDwellMs).toBe(60_000)
        expect(snap.activeIdleMs).toBe(0)
    })

    it('pauses active dwell and idle clocks while document is hidden (e.g. user in bank app)', () => {
        setStuckRoute('/add-money/germany/bank', T0)
        setDepositDetailsStepActive(true, T0)
        evaluateIdleTick(T0 + 10_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(10_000)

        setStuckDocumentVisible(false, T0 + 10_000)
        evaluateIdleTick(T0 + 130_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(10_000)

        setStuckDocumentVisible(true, T0 + 130_000)
        evaluateIdleTick(T0 + 135_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(15_000)
    })

    it('clears screen-scoped moneyFailed/appError on route change (N5) and counts corridor switches across picker visits (N17)', () => {
        setStuckRoute('/withdraw', T0)
        noteStuckAnalyticsEvent(ANALYTICS_EVENTS.WITHDRAW_FAILED)
        expect(getStuckRuntimeSnapshot().flags.moneyFailed).toBe(true)

        // Moving to /qr-pay clears moneyFailed so the old failure never follows the user.
        setStuckRoute('/qr-pay', T0 + 5_000)
        expect(getStuckRuntimeSnapshot().flags.moneyFailed).toBe(false)
        expect(getStuckRuntimeSnapshot().hadSessionFriction).toBe(true)

        // Corridor bounce survives /add-money picker visits.
        setStuckRoute('/add-money/argentina/manteca', T0 + 10_000)
        setStuckRoute('/add-money', T0 + 12_000)
        setStuckRoute('/add-money/germany/bank', T0 + 14_000)
        setStuckRoute('/add-money', T0 + 16_000)
        setStuckRoute('/add-money/spain/bank', T0 + 18_000)
        expect(getStuckRuntimeSnapshot().corridorSwitchCount).toBe(2)
    })

    it('tracks dwell since passkey cancel (N11), ref-counts busy sources (B5), and clears verify attempts when fixed (N10)', () => {
        setStuckRoute('/setup', T0)
        setPasskeyStepState('ready', T0)
        evaluateIdleTick(T0 + 30_000)
        expect(getStuckRuntimeSnapshot().activeDwellSincePasskeyCancelMs).toBe(0)

        noteStuckAnalyticsEvent(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED)
        evaluateIdleTick(T0 + 40_000)
        expect(getStuckRuntimeSnapshot().activeDwellSincePasskeyCancelMs).toBe(10_000)

        // Source-keyed busy latch: clearing one source keeps busy true while another is active.
        setStuckFlowBusy(true, 'passkey')
        setStuckFlowBusy(true, 'pending-charge-send')
        setStuckFlowBusy(false, 'passkey')
        expect(getStuckRuntimeSnapshot().isFlowBusy).toBe(true)
        setStuckFlowBusy(false, 'pending-charge-send')
        expect(getStuckRuntimeSnapshot().isFlowBusy).toBe(false)

        noteLocalVerifyFieldError(3)
        expect(getStuckRuntimeSnapshot().localVerifyAttempts).toBe(3)
        clearLocalVerifyFieldError()
        expect(getStuckRuntimeSnapshot().localVerifyAttempts).toBe(0)
    })

    it('resets stale session flags and nudge cap after 30 minutes away', () => {
        noteStuckAnalyticsEvent(ANALYTICS_EVENTS.DEPOSIT_FAILED)
        markSessionNudgeShown()
        expect(getStuckRuntimeSnapshot().flags.moneyFailed).toBe(true)
        expect(getStuckRuntimeSnapshot().sessionNudgeShown).toBe(true)

        evaluateIdleTick(T0 + SESSION_RESET_IDLE_MS + 1_000)
        expect(getStuckRuntimeSnapshot().flags.moneyFailed).toBe(false)
        expect(getStuckRuntimeSnapshot().sessionNudgeShown).toBe(false)
    })

    it('detects rapid clicks on the same element without counting different targets or ignored elements', () => {
        const btnA = document.createElement('button')
        const btnB = document.createElement('button')

        noteElementClick(btnA, 100, 100, false, T0 + 100)
        noteElementClick(btnB, 100, 100, false, T0 + 300)
        noteElementClick(btnA, 100, 100, false, T0 + 500)
        expect(getStuckRuntimeSnapshot().flags.rageTaps).toBe(false)

        noteElementClick(btnA, 102, 102, false, T0 + 700)
        expect(getStuckRuntimeSnapshot().flags.rageTaps).toBe(true)
    })
})
