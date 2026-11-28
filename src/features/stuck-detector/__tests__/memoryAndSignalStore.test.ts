import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    DISMISS_COOLDOWN_MS,
    GLOBAL_QUIET_COOLDOWN_MS,
    markSeenAddMoneyUnfunded,
    readStuckMemory,
    recordObservedFriction,
    recordSurfaceActionCooldown,
    recordSurfaceDismissal,
} from '../memory'
import {
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

    it('persists action cooldown without incrementing explicit dismissal lifetime cap', () => {
        const t0 = 1_700_000_000_000
        const afterAction = recordSurfaceActionCooldown('user-2', 'home_funded', t0)
        expect(afterAction.dismissedUntil.home_funded).toBe(t0 + DISMISS_COOLDOWN_MS)
        expect(afterAction.globalQuietUntil).toBe(t0 + GLOBAL_QUIET_COOLDOWN_MS)
        expect(afterAction.lifetimeDismissCount).toBe(0)
    })

    it('stores factual observed friction and seenAddMoneyUnfunded idempotently', () => {
        expect(readStuckMemory('user-3').priorObservedFriction).toBe(false)
        expect(recordObservedFriction('user-3').priorObservedFriction).toBe(true)
        expect(markSeenAddMoneyUnfunded('user-3').seenAddMoneyUnfunded).toBe(true)
    })

    it('falls back cleanly on corrupted storage JSON', () => {
        window.localStorage.setItem('peanut:stuck-memory:v2:bad', '{not-json')
        const mem = readStuckMemory('bad')
        expect(mem.lifetimeDismissCount).toBe(0)
        expect(mem.priorObservedFriction).toBe(false)
    })
})

describe('stuck-detector signalStore & signalTap', () => {
    const T0 = 1_700_000_000_000

    beforeEach(() => {
        resetStuckRuntimeForTests(T0)
    })

    it('pauses active dwell and idle clocks while document is hidden (e.g. user in bank app)', () => {
        setStuckRoute('/add-money/germany/bank', T0)
        setDepositDetailsStepActive(true, T0)
        evaluateIdleTick(T0 + 10_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(10_000)

        // User switches to their bank app for 2 minutes.
        setStuckDocumentVisible(false, T0 + 10_000)
        evaluateIdleTick(T0 + 130_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(10_000)

        // User returns; only active visible time after resume counts.
        setStuckDocumentVisible(true, T0 + 130_000)
        evaluateIdleTick(T0 + 135_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(15_000)
    })

    it('resets dwell when entering deposit-details or passkey ready steps', () => {
        setStuckRoute('/add-money/germany/bank', T0)
        evaluateIdleTick(T0 + 25_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(25_000)

        // Entering the actual details screen resets loading/amount dwell back to 0.
        setDepositDetailsStepActive(true, T0 + 25_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(0)

        setStuckRoute('/setup', T0 + 30_000)
        evaluateIdleTick(T0 + 50_000)
        setPasskeyStepState('ready', T0 + 50_000)
        expect(getStuckRuntimeSnapshot().activeDwellMs).toBe(0)
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

    it('resets longIdle on keyboard/scroll activity and taps PostHog $rageclick + failures', () => {
        evaluateIdleTick(T0 + 26_000)
        expect(getStuckRuntimeSnapshot().flags.longIdle).toBe(true)

        noteUserActivity(T0 + 27_000)
        expect(getStuckRuntimeSnapshot().flags.longIdle).toBe(false)
        expect(getStuckRuntimeSnapshot().activeIdleMs).toBe(0)

        noteStuckAnalyticsEvent('$rageclick')
        expect(getStuckRuntimeSnapshot().flags.rageTaps).toBe(true)

        noteStuckAnalyticsEvent(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED)
        expect(getStuckRuntimeSnapshot().passkeyCancelCount).toBe(1)

        noteLocalVerifyFieldError(3)
        expect(getStuckRuntimeSnapshot().localVerifyAttempts).toBe(3)

        setStuckFlowBusy(true)
        expect(getStuckRuntimeSnapshot().isFlowBusy).toBe(true)
    })
})
