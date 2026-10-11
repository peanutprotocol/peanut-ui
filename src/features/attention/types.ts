import type { OnboardingState } from '@/utils/activation-step.utils'
import type { IdentityVerificationStatus } from '@/types/capabilities'

/**
 * The attention arbiter: every self-opening prompt (modal, drawer, Home card)
 * is an `AttentionAsk`, and `decide()` picks at most one interrupt and one
 * Home zone card from the ones that are eligible right now. Nothing may open
 * on its own; it asks, and the arbiter answers.
 *
 * Tiers rank urgency among asks that are eligible at the same moment. Journey
 * dependencies live in `eligible()`, never in the rank: an ask that needs an
 * active card is simply never `show` for a user who still has to verify.
 */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6

export type Surface = 'interrupt' | 'zone'

/**
 * - `show`: eligible, wants a surface now
 * - `pending`: in progress, nothing for the user to do (an ID check in review);
 *   the zone may render its status, never a CTA
 * - `done` / `ineligible`: silent
 * - `unknown`: its data is not loaded. A higher-tier `unknown` holds every
 *   lower-tier interrupt until it settles or the settle deadline passes.
 */
export type Verdict = 'show' | 'pending' | 'done' | 'ineligible' | 'unknown'

export type AskId =
    | 'legal-reconsent'
    | 'balance-backup'
    | 'verification-due'
    | 'post-verification-action'
    | 'finish-card-setup'
    | 'install-app'
    | 'blocked-card'
    | 'checklist'
    | 'push-home-fallback'
    | 'early-user'

/**
 * Who may interrupt, by default per tier:
 * - `always`: T1, any session, even after another interrupt closed
 * - `session`: T3/T4, at most one interrupt per session and none after a T1
 * - `quiet`: T6, only when the zone has nothing in T1–T5, from the third
 *   session on, with a cooldown between announcements
 * - `never`: T2/T5, zone only
 */
export type InterruptBudget = 'always' | 'session' | 'quiet' | 'never'

export interface AskPolicy {
    /** where an interrupt may open; the zone is Home by definition */
    routes?: 'home' | 'any'
    /** overrides the tier's default budget (the migration prompt: T2 but may interrupt) */
    interrupt?: InterruptBudget
    /** days a "Not now" silences the ask; absent = a dismissal is permanent */
    snoozeDays?: number
    /** days after which a dismissal re-arms (the balance warning: 21) */
    expiryDays?: number
    /** the Home push ask never asks on the first visits */
    minSessions?: number
    /** zone fatigue: sessions the card may hold the zone before yielding one session (T3+) */
    maxConsecutiveSessions?: number
}

export interface AttentionAsk {
    id: AskId
    tier: Tier
    /** order inside the tier, following the Notion journey order */
    rank: number
    /** preferred first; the arbiter degrades to the next when the first is not allowed now */
    surfaces: Surface[]
    eligible: (state: JourneyState) => Verdict
    /** a changed version re-arms a dismissed or snoozed ask (a new legal document, a new reason code) */
    version?: (state: JourneyState) => string | undefined
    policy: AskPolicy
    /** the legacy `modal_type` value, so existing dashboards keep working */
    analyticsKey: string
}

export interface JourneyState {
    now: number
    /** null while logged out */
    userId: string | null
    userLoaded: boolean
    isNative: boolean
    route: 'home' | 'other'
    consent: { status: 'unknown' | 'clear' | 'needed'; versions: string[] }
    identity: {
        status: IdentityVerificationStatus | undefined
        isVerified: boolean
        needsAction: boolean
        isTerminalFailure: boolean
        isRegionRestricted: boolean
    }
    /** null while the checklist inputs are loading */
    onboarding: OnboardingState | null
    /** the blocked card's dismissal key (`blockedCardCtaId`), null when no door is shut */
    blockedCardId: string | null
    /** pending Bridge verification tasks due now (selectHomeTasks().largeTasks) */
    dueTasks: number
    card: { loaded: boolean; needsSetup: boolean }
    /** a stored post-auth redirect that a post-signup action matches */
    postAuthRedirect: boolean
    balance: { loaded: boolean; usd: number }
    migration: { on: boolean }
    push: { ready: boolean; unanswered: boolean }
    showEarlyUserModal: boolean | undefined
}

export interface LedgerEntry {
    /** ISO timestamps, newest last, capped */
    shownAt?: string[]
    dismissedAt?: string
    snoozedUntil?: string
    /** the ask version the dismissal or snooze belongs to */
    version?: string
    /** zone fatigue bookkeeping */
    lastSessionShown?: number
    consecutiveSessions?: number
}

export type Ledger = Partial<Record<AskId, LedgerEntry>>

export interface Session {
    /** app loads by this user on this device (prefs.sessionCount) */
    count: number
    route: 'home' | 'other'
    interruptsThisSession: AskId[]
    /** the arbiter-owned interrupt on screen, kept while it stays eligible */
    openInterrupt: AskId | null
    /** a user-opened overlay or a flow in progress: nothing new opens */
    busy: boolean
    /** offline, locked, backend down: the arbiter pauses */
    gateUp: boolean
    /** the settle deadline passed: `unknown` no longer holds lower tiers */
    settleDeadlinePassed: boolean
}

export interface ZonePick {
    id: AskId
    /** `status` renders the pending state of an in-progress ask, not a CTA */
    mode: 'ask' | 'status'
}

export interface Decision {
    interrupt: AskId | null
    zone: ZonePick | null
    suspended: boolean
    trace: DecisionTrace
}

export interface DecisionTrace {
    verdicts: Partial<Record<AskId, Verdict>>
    /** asks with verdict `show` that the ledger does not silence, in priority order */
    candidates: AskId[]
    /** why each candidate was not the interrupt */
    reasons: Partial<Record<AskId, string>>
}
