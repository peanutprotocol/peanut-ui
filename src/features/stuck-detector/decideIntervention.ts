import { LIFETIME_DISMISS_CAP } from './memory'
import type {
    StuckBuddyPose,
    StuckDecisionInput,
    StuckInterventionDecision,
    StuckSurface,
    StuckTriggerReason,
} from './types'

/** Active visible dwell on bank transfer details before offering deposit help. */
export const DEPOSIT_DETAILS_DWELL_MS = 45_000

/** Minimum visible dwell on a repeat unfunded bank-details visit (avoids instant 0s flash on amount edits). */
export const REPEAT_UNFUNDED_DWELL_MS = 15_000

/** Active visible dwell on Passkey step *after* a real cancel/failure. */
export const PASSKEY_STALL_AFTER_CANCEL_MS = 25_000

/** Quiet active visible idle duration on `/home` before Peanut pops in for a brief silent wave cameo. */
export const HOME_IDLE_WAVE_MS = 60_000

export const SURFACE_POSE: Record<StuckSurface, StuckBuddyPose> = {
    add_money: 'waving-hello',
    verify_loop: 'thinking',
    setup_passkey: 'waving-hello',
    home_funded: 'waving-hello',
    home_wave: 'waving-hello',
    active_issue: 'worried',
}

interface RuleMatch {
    surface: StuckSurface
    mode: 'stuck' | 'whimsy'
    reason: Exclude<StuckTriggerReason, 'demo_override'>
}

function matchHomeWhimsy(input: StuckDecisionInput): RuleMatch | null {
    return input.activeIdleMs >= HOME_IDLE_WAVE_MS
        ? { surface: 'home_wave', mode: 'whimsy', reason: 'home_idle_wave' }
        : null
}

function matchSurfaceRule(input: StuckDecisionInput): RuleMatch | null {
    const { surface } = input
    if (!surface) return null

    switch (surface) {
        case 'add_money': {
            if (!input.isDepositDetailsStep) return null
            const repeatUnfunded =
                input.seenDepositDetailsUnfundedInSession &&
                input.balanceUsd !== null &&
                input.balanceUsd <= 0 &&
                input.activeDwellMs >= REPEAT_UNFUNDED_DWELL_MS
            if (repeatUnfunded) {
                return { surface, mode: 'stuck', reason: 'repeat_unfunded_visit' }
            }
            if (input.corridorSwitchCount >= 2) {
                return { surface, mode: 'stuck', reason: 'corridor_bounce' }
            }
            if (input.activeDwellMs >= DEPOSIT_DETAILS_DWELL_MS) {
                return { surface, mode: 'stuck', reason: 'deposit_dwell' }
            }
            return null
        }

        case 'verify_loop': {
            if (input.localVerifyAttempts >= 3) {
                return { surface, mode: 'stuck', reason: 'verify_field_loop' }
            }
            return null
        }

        case 'setup_passkey': {
            if (input.passkeyCancelCount >= 2) {
                return { surface, mode: 'stuck', reason: 'passkey_repeat_cancel' }
            }
            if (
                input.passkeyCancelCount >= 1 &&
                input.activeDwellSincePasskeyCancelMs >= PASSKEY_STALL_AFTER_CANCEL_MS
            ) {
                return { surface, mode: 'stuck', reason: 'passkey_stall_after_cancel' }
            }
            return null
        }

        case 'home_funded': {
            const isFundedUnspent = input.balanceUsd !== null && input.balanceUsd >= 10 && !input.hasSpent
            if (isFundedUnspent && input.hadSessionFriction) {
                return { surface, mode: 'stuck', reason: 'funded_no_spend' }
            }
            return matchHomeWhimsy(input)
        }

        case 'home_wave':
            return matchHomeWhimsy(input)

        case 'active_issue': {
            if (input.errorRetryCount >= 2) {
                return { surface, mode: 'stuck', reason: 'repeat_error_retry' }
            }
            if (input.flags.moneyFailed) {
                return { surface, mode: 'stuck', reason: 'active_money_failed' }
            }
            if (input.flags.appError && input.flags.rageTaps) {
                return { surface, mode: 'stuck', reason: 'active_error_rage' }
            }
            return null
        }

        default: {
            const _exhaustive: never = surface
            return _exhaustive
        }
    }
}

/**
 * Pure deterministic eligibility gate for the walking Peanut buddy.
 *
 * Enforces all safety invariants in one place:
 *   - Safety guards (overlay, keyboard, flow-busy) run before BOTH real and demo triggers.
 *   - Demo parameter is strictly ignored on the production domain (`isProdDomain === true`).
 *   - `home_wave` whimsy uses its own session cap (`sessionWhimsyShown`) and never spends the
 *     session's real stuck-help nudge (`sessionNudgeShown`) or global 24h quiet period.
 *   - Evaluates the real trigger rule identically when `uiEnabled === false` so control-arm
 *     holdout eligibility (`eligibleInControl`) matches treatment.
 */
export function decideStuckIntervention(input: StuckDecisionInput): StuckInterventionDecision {
    if (input.hasOverlayOpen) return { show: false, suppressedBy: 'overlay_open' }
    if (input.isKeyboardOpen) return { show: false, suppressedBy: 'keyboard_open' }
    if (input.isFlowBusy) return { show: false, suppressedBy: 'flow_busy' }

    const activeDemo = !input.isProdDomain ? input.demoSurface : null
    if (activeDemo) {
        if (input.dismissedThisVisit) return { show: false, suppressedBy: 'dismissed_this_visit' }
        return {
            show: true,
            eligible: false,
            surface: activeDemo,
            pose: SURFACE_POSE[activeDemo],
            mode: activeDemo === 'home_wave' ? 'whimsy' : 'stuck',
            reason: 'demo_override',
            isDemo: true,
        }
    }

    if (input.dismissedThisVisit) return { show: false, suppressedBy: 'dismissed_this_visit' }

    const { surface } = input
    if (!surface) return { show: false, suppressedBy: 'no_surface' }

    if (surface === 'setup_passkey') {
        if (input.passkeyStepState === 'dedicated_help') {
            return { show: false, suppressedBy: 'setup_error_open' }
        }
        if (input.passkeyStepState !== 'ready') {
            return { show: false, suppressedBy: 'no_surface' }
        }
    }

    const match = matchSurfaceRule(input)
    if (!match) return { show: false, suppressedBy: 'below_threshold' }

    if (match.mode === 'whimsy') {
        if (input.sessionWhimsyShown) return { show: false, suppressedBy: 'already_nudged_session' }
        if (input.memory.lifetimeDismissCount >= LIFETIME_DISMISS_CAP) {
            return { show: false, suppressedBy: 'lifetime_cap_reached' }
        }
        const waveCooldown = input.memory.dismissedUntil.home_wave ?? 0
        if (waveCooldown > input.nowMs) return { show: false, suppressedBy: 'cooldown_active' }
    } else {
        if (input.sessionNudgeShown) return { show: false, suppressedBy: 'already_nudged_session' }
        if (input.memory.lifetimeDismissCount >= LIFETIME_DISMISS_CAP) {
            return { show: false, suppressedBy: 'lifetime_cap_reached' }
        }
        if (input.memory.globalQuietUntil > input.nowMs) {
            return { show: false, suppressedBy: 'cooldown_active' }
        }
        const cooldownUntil = input.memory.dismissedUntil[match.surface] ?? 0
        if (cooldownUntil > input.nowMs) return { show: false, suppressedBy: 'cooldown_active' }
    }

    if (!input.uiEnabled) {
        return {
            show: false,
            eligibleInControl: match,
            suppressedBy: 'flag_off',
        }
    }

    return {
        show: true,
        eligible: true,
        surface: match.surface,
        pose: SURFACE_POSE[match.surface],
        mode: match.mode,
        reason: match.reason,
        isDemo: false,
    }
}
