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

export type StuckSurface = 'add_money' | 'verify_loop' | 'setup_passkey' | 'home_funded' | 'active_issue'

/** Poses the walking Peanut buddy can morph into cleanly from `walking`. */
export type StuckBuddyPose = Extract<MascotPose, 'waving-hello' | 'thinking' | 'worried' | 'sad'>

export type BugReportCategory = 'payment_failed' | 'screen_stuck' | 'something_wrong'

export interface StuckModelArtifact {
    version: string
    features: readonly string[]
    baseLogit: number
    learningRate: number
    defaultThreshold: number
    trees: readonly GbdtNode[]
}

/** Compact JSON tree node: `[featureIdx, threshold, left, right]` or `[leafValue]`. */
export type GbdtNode = readonly [number] | readonly [number, number, GbdtNode, GbdtNode]

export interface StuckSessionFlags {
    appError: boolean
    rageTaps: boolean
    longIdle: boolean
    moneyFailed: boolean
    moneyStuck: boolean
    kycBlocked: boolean
}

export interface StuckMemory {
    sessionCount: number
    priorObsFriction: number
    priorStuck: number
    prevWasStuck: boolean
    seenAddMoneyUnfunded: boolean
    dismissedUntil: Partial<Record<StuckSurface, number>>
}

export interface StuckScoreInput {
    flags: StuckSessionFlags
    durationSeconds: number
    loggedIn: boolean
    journey: StuckJourney
    platform: 'ios-native' | 'android-native' | 'web'
    memory: StuckMemory
}

export interface StuckScoreResult {
    rawScore: number
    smoothedScore: number
    features: number[]
    modelVersion: string
}

export type PasskeyStepState = 'inactive' | 'ready' | 'dedicated_help'

export interface StuckDecisionInput {
    pathname: string
    surface: StuckSurface | null
    rawScore: number
    smoothedScore: number
    elapsedOnScreenMs: number
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
    balanceUsd: number | null
    hasSpent: boolean
    demoSurface: StuckSurface | null
}

export type StuckSuppressionReason =
    | 'no_surface'
    | 'overlay_open'
    | 'keyboard_open'
    | 'flow_busy'
    | 'setup_error_open'
    | 'already_nudged_session'
    | 'cooldown_active'
    | 'below_threshold'

export type StuckInterventionDecision =
    | {
          show: true
          surface: StuckSurface
          pose: StuckBuddyPose
          reason: string
          isDemo: boolean
      }
    | {
          show: false
          suppressedBy: StuckSuppressionReason
      }
