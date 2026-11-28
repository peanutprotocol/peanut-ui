import { decideStuckIntervention } from '../decideIntervention'
import type { StuckDecisionInput } from '../types'

const BASE_INPUT: StuckDecisionInput = {
    pathname: '/add-money',
    surface: 'add_money',
    rawScore: 0.72,
    smoothedScore: 0.68,
    elapsedOnScreenMs: 50_000,
    flags: {
        appError: false,
        rageTaps: false,
        longIdle: true,
        moneyFailed: false,
        moneyStuck: true,
        kycBlocked: false,
    },
    memory: {
        sessionCount: 2,
        priorObsFriction: 1,
        priorStuck: 1,
        prevWasStuck: true,
        seenAddMoneyUnfunded: true,
        dismissedUntil: {},
    },
    nowMs: 1_700_000_000_000,
    sessionNudgeShown: false,
    hasOverlayOpen: false,
    isKeyboardOpen: false,
    isFlowBusy: false,
    isSetupErrorScreenOpen: false,
    localVerifyAttempts: 0,
    passkeyCancelCount: 0,
    corridorSwitchCount: 0,
    errorRetryCount: 0,
    balanceUsd: 0,
    hasSpent: false,
    demoSurface: null,
}

describe('decideStuckIntervention', () => {
    it('suppresses whenever an overlay, keyboard, busy flow, or prior session nudge is active', () => {
        expect(decideStuckIntervention({ ...BASE_INPUT, hasOverlayOpen: true })).toEqual({
            show: false,
            suppressedBy: 'overlay_open',
        })
        expect(decideStuckIntervention({ ...BASE_INPUT, isKeyboardOpen: true })).toEqual({
            show: false,
            suppressedBy: 'keyboard_open',
        })
        expect(decideStuckIntervention({ ...BASE_INPUT, isFlowBusy: true })).toEqual({
            show: false,
            suppressedBy: 'flow_busy',
        })
        expect(decideStuckIntervention({ ...BASE_INPUT, sessionNudgeShown: true })).toEqual({
            show: false,
            suppressedBy: 'already_nudged_session',
        })
    })

    it('honors the 7-day per-surface dismissal cooldown', () => {
        const res = decideStuckIntervention({
            ...BASE_INPUT,
            memory: {
                ...BASE_INPUT.memory,
                dismissedUntil: { add_money: BASE_INPUT.nowMs + 10_000 },
            },
        })
        expect(res).toEqual({ show: false, suppressedBy: 'cooldown_active' })
    })

    it('never duplicates Passkey error screens or PasskeySetupHelpDrawer on /setup', () => {
        const blocked = decideStuckIntervention({
            ...BASE_INPUT,
            pathname: '/setup',
            surface: 'setup_passkey',
            isSetupErrorScreenOpen: true,
            passkeyCancelCount: 3,
        })
        expect(blocked).toEqual({ show: false, suppressedBy: 'setup_error_open' })

        const silentStall = decideStuckIntervention({
            ...BASE_INPUT,
            pathname: '/setup',
            surface: 'setup_passkey',
            isSetupErrorScreenOpen: false,
            rawScore: 0.75,
            elapsedOnScreenMs: 30_000,
        })
        expect(silentStall).toMatchObject({ show: true, surface: 'setup_passkey', pose: 'waving-hello' })
    })

    it('triggers verify buddy on 3rd local field error regardless of PostHog dedup', () => {
        const res = decideStuckIntervention({
            ...BASE_INPUT,
            pathname: '/verify',
            surface: 'verify_loop',
            rawScore: 0.4,
            smoothedScore: 0.4,
            localVerifyAttempts: 3,
        })
        expect(res).toMatchObject({ show: true, surface: 'verify_loop', pose: 'thinking', reason: 'verify_field_loop' })
    })

    it('triggers home_funded only when balance >= $10, 0 spends, and prior friction exists', () => {
        const ok = decideStuckIntervention({
            ...BASE_INPUT,
            pathname: '/home',
            surface: 'home_funded',
            balanceUsd: 48.2,
            hasSpent: false,
        })
        expect(ok).toMatchObject({ show: true, surface: 'home_funded', pose: 'waving-hello' })

        const alreadySpent = decideStuckIntervention({
            ...BASE_INPUT,
            pathname: '/home',
            surface: 'home_funded',
            balanceUsd: 48.2,
            hasSpent: true,
        })
        expect(alreadySpent).toEqual({ show: false, suppressedBy: 'below_threshold' })
    })

    it('triggers worried Peanut on active-user repeated failure', () => {
        const res = decideStuckIntervention({
            ...BASE_INPUT,
            pathname: '/qr-pay',
            surface: 'active_issue',
            hasSpent: true,
            flags: { ...BASE_INPUT.flags, moneyFailed: true },
            errorRetryCount: 2,
        })
        expect(res).toMatchObject({ show: true, surface: 'active_issue', pose: 'worried' })
    })

    it('allows explicit non-prod demo override', () => {
        const res = decideStuckIntervention({
            ...BASE_INPUT,
            hasOverlayOpen: true,
            demoSurface: 'active_issue',
        })
        expect(res).toMatchObject({ show: true, surface: 'active_issue', pose: 'worried', isDemo: true })
    })
})
