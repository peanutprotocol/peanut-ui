import type { StuckBuddyPose, StuckDecisionInput, StuckInterventionDecision, StuckSurface } from './types'

export const STUCK_THRESHOLDS = {
    addMoney: 0.6,
    verify: 0.65,
    setupPasskey: 0.7,
    homeFunded: 0.6,
    activeIssue: 0.6,
} as const

export const SURFACE_POSE: Record<StuckSurface, StuckBuddyPose> = {
    add_money: 'waving-hello',
    verify_loop: 'thinking',
    setup_passkey: 'waving-hello',
    home_funded: 'waving-hello',
    active_issue: 'worried',
}

/**
 * Pure deterministic eligibility gate for the walking Peanut buddy.
 * Never mutates state or performs I/O — every guardrail is testable in isolation.
 */
export function decideStuckIntervention(input: StuckDecisionInput): StuckInterventionDecision {
    if (input.demoSurface) {
        return {
            show: true,
            surface: input.demoSurface,
            pose: SURFACE_POSE[input.demoSurface],
            reason: 'demo_override',
            isDemo: true,
        }
    }

    const { surface } = input
    if (!surface) return { show: false, suppressedBy: 'no_surface' }
    if (input.hasOverlayOpen) return { show: false, suppressedBy: 'overlay_open' }
    if (input.isKeyboardOpen) return { show: false, suppressedBy: 'keyboard_open' }
    if (input.isFlowBusy) return { show: false, suppressedBy: 'flow_busy' }
    if (surface === 'setup_passkey' && input.isSetupErrorScreenOpen) {
        return { show: false, suppressedBy: 'setup_error_open' }
    }
    if (input.sessionNudgeShown) return { show: false, suppressedBy: 'already_nudged_session' }

    const cooldownUntil = input.memory.dismissedUntil[surface] ?? 0
    if (cooldownUntil > input.nowMs) return { show: false, suppressedBy: 'cooldown_active' }

    const score = Math.max(input.rawScore, input.smoothedScore)

    switch (surface) {
        case 'add_money': {
            const prolongedDwell = input.elapsedOnScreenMs >= 45_000
            const corridorBounce = input.corridorSwitchCount >= 2
            const repeatUnfunded = input.memory.seenAddMoneyUnfunded && (input.balanceUsd ?? 0) <= 0
            if (score >= STUCK_THRESHOLDS.addMoney && (prolongedDwell || corridorBounce || repeatUnfunded)) {
                return {
                    show: true,
                    surface,
                    pose: SURFACE_POSE[surface],
                    reason: repeatUnfunded
                        ? 'repeat_unfunded_visit'
                        : corridorBounce
                          ? 'corridor_bounce'
                          : 'deposit_dwell',
                    isDemo: false,
                }
            }
            return { show: false, suppressedBy: 'below_threshold' }
        }

        case 'verify_loop': {
            if (input.localVerifyAttempts >= 3) {
                return {
                    show: true,
                    surface,
                    pose: SURFACE_POSE[surface],
                    reason: 'verify_field_loop',
                    isDemo: false,
                }
            }
            if (score >= STUCK_THRESHOLDS.verify && input.elapsedOnScreenMs >= 35_000) {
                return {
                    show: true,
                    surface,
                    pose: SURFACE_POSE[surface],
                    reason: 'verify_model_stall',
                    isDemo: false,
                }
            }
            return { show: false, suppressedBy: 'below_threshold' }
        }

        case 'setup_passkey': {
            const silentStall = input.elapsedOnScreenMs >= 25_000 || input.passkeyCancelCount >= 2
            if (score >= STUCK_THRESHOLDS.setupPasskey && silentStall) {
                return {
                    show: true,
                    surface,
                    pose: SURFACE_POSE[surface],
                    reason: input.passkeyCancelCount >= 2 ? 'passkey_repeat_cancel' : 'passkey_silent_stall',
                    isDemo: false,
                }
            }
            return { show: false, suppressedBy: 'below_threshold' }
        }

        case 'home_funded': {
            const isFundedUnspent = (input.balanceUsd ?? 0) >= 10 && !input.hasSpent
            const hadPriorFriction = input.memory.priorStuck >= 1 || input.memory.prevWasStuck
            if (isFundedUnspent && hadPriorFriction && score >= STUCK_THRESHOLDS.homeFunded) {
                return {
                    show: true,
                    surface,
                    pose: SURFACE_POSE[surface],
                    reason: 'funded_no_spend',
                    isDemo: false,
                }
            }
            return { show: false, suppressedBy: 'below_threshold' }
        }

        case 'active_issue': {
            const hasHardSignal =
                input.flags.moneyFailed || input.flags.appError || input.flags.rageTaps || input.errorRetryCount >= 2
            if ((score >= STUCK_THRESHOLDS.activeIssue && hasHardSignal) || input.errorRetryCount >= 2) {
                return {
                    show: true,
                    surface,
                    pose: input.flags.moneyFailed || input.errorRetryCount >= 2 ? 'worried' : SURFACE_POSE[surface],
                    reason: input.errorRetryCount >= 2 ? 'repeat_error_retry' : 'active_friction_model',
                    isDemo: false,
                }
            }
            return { show: false, suppressedBy: 'below_threshold' }
        }
    }
}
