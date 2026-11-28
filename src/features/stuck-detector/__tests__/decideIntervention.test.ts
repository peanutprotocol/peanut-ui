import fc from 'fast-check'
import {
    decideStuckIntervention,
    DEPOSIT_DETAILS_DWELL_MS,
    HOME_IDLE_WAVE_MS,
    PASSKEY_STALL_AFTER_CANCEL_MS,
} from '../decideIntervention'
import {
    createDefaultStuckMemory,
    DISMISS_COOLDOWN_MS,
    GLOBAL_QUIET_COOLDOWN_MS,
    LIFETIME_DISMISS_CAP,
} from '../memory'
import {
    canonicalStuckRoute,
    isBankDepositPath,
    isNonBankDepositRailPath,
    journeyForPath,
    parseDemoSurface,
    surfaceForPath,
} from '../routeJourney'
import type { StuckDecisionInput, StuckSurface } from '../types'

const NOW = 1_700_000_000_000

const baseInput = (overrides: Partial<StuckDecisionInput> = {}): StuckDecisionInput => ({
    surface: 'add_money',
    uiEnabled: true,
    isProd: false,
    dismissedThisVisit: false,
    isDepositDetailsStep: true,
    activeDwellMs: 50_000,
    activeIdleMs: 10_000,
    flags: {
        appError: false,
        rageTaps: false,
        longIdle: false,
        moneyFailed: false,
        moneyStuck: false,
        kycBlocked: false,
    },
    memory: createDefaultStuckMemory(),
    nowMs: NOW,
    sessionNudgeShown: false,
    hasOverlayOpen: false,
    isKeyboardOpen: false,
    isFlowBusy: false,
    passkeyStepState: 'inactive',
    localVerifyAttempts: 0,
    passkeyCancelCount: 0,
    corridorSwitchCount: 0,
    errorRetryCount: 0,
    balanceUsd: 0,
    hasSpent: false,
    demoSurface: null,
    ...overrides,
})

describe('decideStuckIntervention', () => {
    it('enforces all hard safety guards even when demoSurface is set', () => {
        expect(decideStuckIntervention(baseInput({ demoSurface: 'add_money', hasOverlayOpen: true }))).toEqual({
            show: false,
            suppressedBy: 'overlay_open',
        })
        expect(decideStuckIntervention(baseInput({ demoSurface: 'add_money', isKeyboardOpen: true }))).toEqual({
            show: false,
            suppressedBy: 'keyboard_open',
        })
        expect(decideStuckIntervention(baseInput({ demoSurface: 'add_money', isFlowBusy: true }))).toEqual({
            show: false,
            suppressedBy: 'flow_busy',
        })
    })

    it('strictly ignores demoSurface in production', () => {
        const res = decideStuckIntervention(
            baseInput({
                isProd: true,
                demoSurface: 'active_issue',
                surface: 'verify_loop',
                localVerifyAttempts: 0,
            })
        )
        expect(res).toEqual({ show: false, suppressedBy: 'below_threshold' })
    })

    it('reports eligibleInControl identically when flag is off for 50/50 holdout parity', () => {
        const res = decideStuckIntervention(baseInput({ uiEnabled: false }))
        expect(res).toEqual({
            show: false,
            suppressedBy: 'flag_off',
            eligibleInControl: {
                surface: 'add_money',
                mode: 'stuck',
                reason: 'deposit_dwell',
            },
        })
    })

    it('enforces session cap, per-surface cooldown, global quiet period, and lifetime dismiss cap', () => {
        expect(decideStuckIntervention(baseInput({ sessionNudgeShown: true }))).toEqual({
            show: false,
            suppressedBy: 'already_nudged_session',
        })
        expect(
            decideStuckIntervention(
                baseInput({
                    memory: { ...createDefaultStuckMemory(), dismissedUntil: { add_money: NOW + DISMISS_COOLDOWN_MS } },
                })
            )
        ).toEqual({ show: false, suppressedBy: 'cooldown_active' })
        expect(
            decideStuckIntervention(
                baseInput({
                    memory: { ...createDefaultStuckMemory(), globalQuietUntil: NOW + GLOBAL_QUIET_COOLDOWN_MS },
                })
            )
        ).toEqual({ show: false, suppressedBy: 'cooldown_active' })
        expect(
            decideStuckIntervention(
                baseInput({
                    memory: { ...createDefaultStuckMemory(), lifetimeDismissCount: LIFETIME_DISMISS_CAP },
                })
            )
        ).toEqual({ show: false, suppressedBy: 'lifetime_cap_reached' })
    })

    it('only triggers add_money on the actual deposit-details step and never coerces null balance to $0', () => {
        expect(decideStuckIntervention(baseInput({ isDepositDetailsStep: false }))).toEqual({
            show: false,
            suppressedBy: 'below_threshold',
        })
        expect(
            decideStuckIntervention(
                baseInput({
                    isDepositDetailsStep: true,
                    activeDwellMs: 5_000,
                    balanceUsd: null,
                    memory: { ...createDefaultStuckMemory(), seenAddMoneyUnfunded: true },
                })
            )
        ).toEqual({ show: false, suppressedBy: 'below_threshold' })

        const repeatRes = decideStuckIntervention(
            baseInput({
                isDepositDetailsStep: true,
                activeDwellMs: 5_000,
                balanceUsd: 0,
                memory: { ...createDefaultStuckMemory(), seenAddMoneyUnfunded: true },
            })
        )
        expect(repeatRes.show).toBe(true)
        if (repeatRes.show) expect(repeatRes.reason).toBe('repeat_unfunded_visit')
    })

    it('never triggers setup_passkey with zero cancels, and yields to dedicated Passkey help screens', () => {
        expect(
            decideStuckIntervention(
                baseInput({
                    surface: 'setup_passkey',
                    passkeyStepState: 'ready',
                    passkeyCancelCount: 0,
                    activeDwellMs: 120_000,
                })
            )
        ).toEqual({ show: false, suppressedBy: 'below_threshold' })

        expect(
            decideStuckIntervention(
                baseInput({
                    surface: 'setup_passkey',
                    passkeyStepState: 'dedicated_help',
                    passkeyCancelCount: 2,
                })
            )
        ).toEqual({ show: false, suppressedBy: 'setup_error_open' })

        const stalledAfterCancel = decideStuckIntervention(
            baseInput({
                surface: 'setup_passkey',
                passkeyStepState: 'ready',
                passkeyCancelCount: 1,
                activeDwellMs: PASSKEY_STALL_AFTER_CANCEL_MS,
            })
        )
        expect(stalledAfterCancel.show).toBe(true)
        if (stalledAfterCancel.show) expect(stalledAfterCancel.reason).toBe('passkey_stall_after_cancel')
    })

    it('triggers verify_loop only on genuine 3rd repeated validation failure', () => {
        expect(
            decideStuckIntervention(
                baseInput({ surface: 'verify_loop', localVerifyAttempts: 2, activeDwellMs: 90_000 })
            )
        ).toEqual({ show: false, suppressedBy: 'below_threshold' })

        const res = decideStuckIntervention(baseInput({ surface: 'verify_loop', localVerifyAttempts: 3 }))
        expect(res.show).toBe(true)
        if (res.show) {
            expect(res.pose).toBe('thinking')
            expect(res.reason).toBe('verify_field_loop')
        }
    })

    it('triggers home_funded only on verified $10+ balance with factual prior friction, else home_wave after 60s idle', () => {
        const funded = decideStuckIntervention(
            baseInput({
                surface: 'home_funded',
                balanceUsd: 42,
                hasSpent: false,
                memory: { ...createDefaultStuckMemory(), priorObservedFriction: true },
            })
        )
        expect(funded.show).toBe(true)
        if (funded.show) {
            expect(funded.surface).toBe('home_funded')
            expect(funded.mode).toBe('stuck')
        }

        const quietWave = decideStuckIntervention(
            baseInput({
                surface: 'home_funded',
                balanceUsd: 0,
                activeIdleMs: HOME_IDLE_WAVE_MS,
            })
        )
        expect(quietWave.show).toBe(true)
        if (quietWave.show) {
            expect(quietWave.surface).toBe('home_wave')
            expect(quietWave.mode).toBe('whimsy')
            expect(quietWave.reason).toBe('home_idle_wave')
        }

        // Cooldown on home_wave must suppress fallthrough from home_funded too.
        const cooledWave = decideStuckIntervention(
            baseInput({
                surface: 'home_funded',
                balanceUsd: 0,
                activeIdleMs: HOME_IDLE_WAVE_MS,
                memory: { ...createDefaultStuckMemory(), dismissedUntil: { home_wave: NOW + DISMISS_COOLDOWN_MS } },
            })
        )
        expect(cooledWave).toEqual({ show: false, suppressedBy: 'cooldown_active' })
    })

    it('triggers active_issue with worried pose on hard failure or 2+ retries', () => {
        const res = decideStuckIntervention(
            baseInput({
                surface: 'active_issue',
                errorRetryCount: 2,
            })
        )
        expect(res.show).toBe(true)
        if (res.show) {
            expect(res.pose).toBe('worried')
            expect(res.reason).toBe('repeat_error_retry')
        }
    })
})

describe('decideStuckIntervention property invariants', () => {
    const surfaceArb = fc.constantFrom<StuckSurface | null>(
        'add_money',
        'verify_loop',
        'setup_passkey',
        'home_funded',
        'home_wave',
        'active_issue',
        null
    )
    const demoArb = fc.constantFrom<StuckSurface | null>(
        'add_money',
        'verify_loop',
        'setup_passkey',
        'home_funded',
        'home_wave',
        'active_issue',
        null
    )

    it('never renders UI when uiEnabled is false and demo is absent (or in prod)', () => {
        fc.assert(
            fc.property(
                surfaceArb,
                demoArb,
                fc.boolean(),
                fc.boolean(),
                fc.integer({ min: 0, max: 180_000 }),
                fc.integer({ min: 0, max: 180_000 }),
                (surface, demoSurface, isProd, moneyFailed, activeDwellMs, activeIdleMs) => {
                    const effectiveDemo = isProd ? demoSurface : null
                    const res = decideStuckIntervention(
                        baseInput({
                            surface,
                            uiEnabled: false,
                            isProd,
                            demoSurface: effectiveDemo,
                            activeDwellMs,
                            activeIdleMs,
                            flags: { ...baseInput().flags, moneyFailed },
                        })
                    )
                    expect(res.show).toBe(false)
                }
            )
        )
    })

    it('never shows with zero friction and under 60s idle on any surface', () => {
        fc.assert(
            fc.property(
                surfaceArb,
                fc.integer({ min: 0, max: DEPOSIT_DETAILS_DWELL_MS - 1 }),
                fc.integer({ min: 0, max: HOME_IDLE_WAVE_MS - 1 }),
                fc.boolean(),
                (surface, activeDwellMs, activeIdleMs, hasSpent) => {
                    const res = decideStuckIntervention(
                        baseInput({
                            surface,
                            activeDwellMs,
                            activeIdleMs,
                            hasSpent,
                            balanceUsd: 50,
                            passkeyStepState: 'ready',
                            passkeyCancelCount: 0,
                            localVerifyAttempts: 0,
                            corridorSwitchCount: 0,
                            errorRetryCount: 0,
                            memory: createDefaultStuckMemory(),
                        })
                    )
                    expect(res.show).toBe(false)
                }
            )
        )
    })

    it('never shows when any safety guard, session cap, or lifetime dismiss cap is active', () => {
        fc.assert(
            fc.property(
                surfaceArb,
                demoArb,
                fc.constantFrom('overlay', 'keyboard', 'busy'),
                (surface, demoSurface, guard) => {
                    const res = decideStuckIntervention(
                        baseInput({
                            surface,
                            demoSurface,
                            hasOverlayOpen: guard === 'overlay',
                            isKeyboardOpen: guard === 'keyboard',
                            isFlowBusy: guard === 'busy',
                        })
                    )
                    expect(res.show).toBe(false)
                }
            )
        )
    })
})

describe('routeJourney segment-safe mapping', () => {
    it('routes bank deposit rails cleanly while excluding pickers, crypto, Pix, and unrelated /card-* siblings', () => {
        expect(isBankDepositPath('/add-money/argentina/manteca')).toBe(true)
        expect(isBankDepositPath('/add-money/germany/bank')).toBe(true)
        expect(isBankDepositPath('/add-money/brazil/manteca')).toBe(false)
        expect(isBankDepositPath('/add-money/crypto')).toBe(false)
        expect(isBankDepositPath('/add-money')).toBe(false)

        expect(canonicalStuckRoute('/add-money', 'germany', 'bank')).toBe('/add-money/germany/bank')
        expect(canonicalStuckRoute('/add-money', 'argentina', 'manteca')).toBe('/add-money/argentina/manteca')
        expect(isNonBankDepositRailPath('/add-money/crypto')).toBe(true)
        expect(isNonBankDepositRailPath('/add-money/pix')).toBe(true)

        expect(surfaceForPath('/card', true)).toBe('active_issue')
        expect(surfaceForPath('/card-payment', true)).toBeNull()
        expect(surfaceForPath('/card-recovery', true)).toBeNull()
        expect(surfaceForPath('/card/pin', true)).toBeNull()
        expect(surfaceForPath('/support', false)).toBeNull()
        expect(surfaceForPath('/home', true)).toBe('home_wave')
        expect(surfaceForPath('/home', false)).toBe('home_funded')

        expect(journeyForPath('/pay-request')).toBe('other')
        expect(journeyForPath('/send')).toBe('send')
        expect(parseDemoSurface('?stuck_demo=home_wave', true)).toBe('home_wave')
        expect(parseDemoSurface('?stuck_demo=home_wave', false)).toBeNull()
    })
})
