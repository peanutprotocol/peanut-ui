import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'

export type StuckJourney =
    | 'signup'
    | 'kyc'
    | 'account_setup'
    | 'deposit'
    | 'qr_pay'
    | 'withdraw'
    | 'card'
    | 'send'
    | 'other'

export type StuckSurface = 'add_money' | 'verify_loop' | 'setup_passkey' | 'home_funded' | 'home_wave' | 'active_issue'

/** Poses the walking Peanut buddy transitions into cleanly from `walking`. */
export type StuckBuddyPose = Extract<MascotPose, 'waving-hello' | 'thinking' | 'worried'>

export type BugReportCategory = 'payment_failed' | 'screen_stuck' | 'something_wrong'

export interface StuckSessionFlags {
    appError: boolean
    rageTaps: boolean
    longIdle: boolean
    moneyFailed: boolean
    moneyStuck: boolean
    kycBlocked: boolean
}

/**
 * Functional dismissal preferences + observed factual friction (never model scores).
 * Dismissal fields persist regardless of analytics opt-out so opted-out users are never re-nagged.
 */
export interface StuckMemory {
    /** True only after a real observed error/failure (moneyFailed, kycBlocked, appError) — never a score crossing. */
    priorObservedFriction: boolean
    /** Set when leaving a bank-details screen with verified $0 balance so a 2nd visit can offer deposit help. */
    seenAddMoneyUnfunded: boolean
    /** Per-surface 7-day cooldown timestamps (written on both dismiss and CTA action). */
    dismissedUntil: Partial<Record<StuckSurface, number>>
    /** Cross-surface 24h quiet period after any dismissal or action. */
    globalQuietUntil: number
    /** Lifetime count of explicit dismissals; once >= LIFETIME_DISMISS_CAP, proactive nudges stay off. */
    lifetimeDismissCount: number
}

export type PasskeyStepState = 'inactive' | 'ready' | 'dedicated_help'

export interface StuckDecisionInput {
    surface: StuckSurface | null
    uiEnabled: boolean
    isProd: boolean
    dismissedThisVisit: boolean
    /** True only when `AddMoneyBankDetails` or `MantecaDepositShareDetails` is mounted (not amount/ToS/verify steps). */
    isDepositDetailsStep: boolean
    /** Active visible dwell time on the current screen/step (paused while document is hidden). */
    activeDwellMs: number
    /** Active visible idle time since last pointer/keyboard/scroll activity (paused while hidden). */
    activeIdleMs: number
    flags: StuckSessionFlags
    memory: StuckMemory
    nowMs: number
    sessionNudgeShown: boolean
    hasOverlayOpen: boolean
    isKeyboardOpen: boolean
    isFlowBusy: boolean
    passkeyStepState: PasskeyStepState
    localVerifyAttempts: number
    passkeyCancelCount: number
    corridorSwitchCount: number
    errorRetryCount: number
    /** `null` while wallet balance is still loading (never coerced to 0). */
    balanceUsd: number | null
    hasSpent: boolean
    demoSurface: StuckSurface | null
}

export type StuckSuppressionReason =
    | 'flag_off'
    | 'dismissed_this_visit'
    | 'no_surface'
    | 'overlay_open'
    | 'keyboard_open'
    | 'flow_busy'
    | 'setup_error_open'
    | 'already_nudged_session'
    | 'lifetime_cap_reached'
    | 'cooldown_active'
    | 'below_threshold'

export type StuckTriggerReason =
    | 'demo_override'
    | 'repeat_unfunded_visit'
    | 'corridor_bounce'
    | 'deposit_dwell'
    | 'verify_field_loop'
    | 'passkey_repeat_cancel'
    | 'passkey_stall_after_cancel'
    | 'funded_no_spend'
    | 'home_idle_wave'
    | 'repeat_error_retry'
    | 'active_money_failed'
    | 'active_error_rage'

export type StuckInterventionDecision =
    | {
          show: true
          /** Whether this match would also be eligible in control arm (false for demo overrides). */
          eligible: boolean
          surface: StuckSurface
          pose: StuckBuddyPose
          mode: 'stuck' | 'whimsy'
          reason: StuckTriggerReason
          isDemo: boolean
      }
    | {
          show: false
          /**
           * Set when the trigger rule matched cleanly under all safety guards and caps,
           * and was suppressed ONLY because `uiEnabled === false` (control arm for 50/50 holdout).
           */
          eligibleInControl?: {
              surface: StuckSurface
              mode: 'stuck' | 'whimsy'
              reason: Exclude<StuckTriggerReason, 'demo_override'>
          }
          suppressedBy: StuckSuppressionReason
      }
