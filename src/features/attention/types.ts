import type { OnboardingState } from '@/utils/activation-step.utils'
import type { IdentityVerificationStatus } from '@/types/capabilities'
import type { selectMantecaCapNudge } from '@/utils/capability-gate'

/**
 * The attention manager: every self-opening prompt (modal, drawer, Home card)
 * is an `AttentionAsk`, and `decide()` picks at most one interrupt and one
 * Home zone card from the ones that are eligible right now. Nothing may open
 * on its own; it asks, and the manager answers.
 *
 * Tiers rank urgency among asks that are eligible at the same moment. Journey
 * dependencies live in `eligible()`, never in the rank: an ask that needs an
 * active card is simply never `show` for a user who still has to verify.
 */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6

export type Surface = 'interrupt' | 'zone' | 'inline' | 'banner'
export type InterruptPresentation = 'modal' | 'drawer'
export type SlotId = 'bank-transfer' | 'limits'
export type SlotContext = Record<string, string | number | boolean | null | undefined>
export interface MountedSlot {
    id: SlotId
    context?: SlotContext
}

/**
 * - `show`: eligible, wants a surface now
 * - `pending`: in progress, nothing for the user to do (an ID check in review);
 *   the zone may render its status, never a CTA
 * - `done` / `ineligible`: silent
 * - `unknown`: its data is not loaded. An `unknown` holds every
 *   lower-priority interrupt until it settles or the settle deadline passes.
 */
export type Verdict = 'show' | 'pending' | 'done' | 'ineligible' | 'unknown'

export type AskId =
    | 'verification-deadline'
    | 'cap-nudge'
    | 'maintenance'
    | 'legal-reconsent'
    | 'arrival'
    | 'balance-backup'
    | 'verification-due'
    | 'post-verification-action'
    | 'finish-card-setup'
    | 'install-app'
    | 'blocked-card'
    | 'checklist'
    | 'push-home-fallback'
    | 'early-user'
    | 'verification-advisory'
    | 'qr-payment'
    | 'verify-for-qr'
    | 'card-offer'
    | 'invite'
    | 'bug-bounty'
    | 'user-interview'
    | 'virtual-account'
    | 'next-payment'
    | 'share-bank-details'
    | 'request-money'
    | 'send-money'
    | 'backup-passkey'
    | 'add-email'
    | 'rewards'
    | 'complete-profile'

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
    slotWhen?: (state: JourneyState, context: SlotContext | undefined) => boolean
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
    /** a surface-specific precondition on top of `eligible` (the push ask: interrupt only while unanswered, zone only on native) */
    surfaceWhen?: Partial<Record<Surface, (state: JourneyState) => boolean>>
    /** the to-do list: while live it holds Home, and only a strictly higher tier may overlay it */
    anchorsHome?: boolean
}

export interface AttentionAsk {
    id: AskId
    tier: Tier
    /** order inside the tier, following the Notion journey order */
    rank: number
    /** preferred first; the manager degrades to the next when the first is not allowed now */
    surfaces: Surface[]
    presentation?: InterruptPresentation
    slots?: SlotId[]
    eligible: (state: JourneyState) => Verdict
    /** whether the app holds what its surface shows; a server `show` waits as `pending` until it does */
    renderable?: (state: JourneyState) => boolean
    /** a changed version re-arms a dismissed or snoozed ask (a new legal document, a new reason code) */
    version?: (state: JourneyState) => string | undefined
    policy: AskPolicy
    /** the legacy `modal_type` value, so existing dashboards keep working */
    analyticsKey: string
}

/** What a rendered surface gets: the three ways the user can answer, nothing else. */
export interface AskSurfaceProps {
    presentation: InterruptPresentation
    askId: AskId
    /** the user did the thing (accepted, enabled, tapped the CTA) */
    onActed: () => void
    /** closed without doing it; permanent unless the ask's policy has expiryDays */
    onDismissed: () => void
    /** "Not now"; `until` defaults to now + policy.snoozeDays */
    onSnoozed: (until?: number) => void
}

export interface InlineSurfaceProps extends Omit<AskSurfaceProps, 'presentation'> {
    slot: SlotId
    context?: SlotContext
}

export interface BannerSurfaceProps extends Omit<AskSurfaceProps, 'presentation'> {
    variant: 'feature' | 'global'
    className?: string
}

export interface ZoneSurfaceProps extends Omit<AskSurfaceProps, 'presentation'> {
    /** `status` renders an in-progress state, never a CTA (reserved; no ask uses it yet) */
    mode: 'ask' | 'status'
}

export interface JourneyState {
    capNudge: ReturnType<typeof selectMantecaCapNudge> | null
    maintenance: 'none' | 'scoped' | 'full'
    now: number
    /** null while logged out */
    userId: string | null
    userLoaded: boolean
    isNative: boolean
    route: 'home' | 'other'
    consent: {
        status: 'unknown' | 'clear' | 'needed'
        versions: string[]
        /** the outdated documents this client can display */
        documents: { slug: string; currentVersion: string }[]
    }
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
    card: { loaded: boolean; needsSetup: boolean; activeCardId: string | null }
    /** a stored post-auth redirect that a post-signup action matches */
    postAuthRedirect: boolean
    postAuthRedirectDestination: string | null
    balance: { loaded: boolean; usd: number }
    migration: { on: boolean }
    push: {
        ready: boolean
        unanswered: boolean
        /** the contextual (money-moment) pre-prompt already asked this session */
        promptedThisSession: boolean
        /** native, answered but not on: the card opens the OS settings */
        notEnabled: boolean
    }
    showEarlyUserModal: boolean | undefined
    /** API activation: a card spend or QR pay */
    activated: boolean
    /** IP country, a hint only (AR/BR pick the LatAm invite copy) */
    geoCountry: string | null
    invitesSent: number
    hasSupportSurvivorBadge: boolean
    /** `geoProhibited`: the nav's card gate hides the card (a prohibited country or a card-restricted residence) */
    cardOffer: { loaded: boolean; geoProhibited: boolean; hasCardRelationship: boolean; promotionDisabled: boolean }
    qr: {
        canPayNow: boolean
        /** undefined while history loads: the card must not flash in and out */
        hasMadeQrPayment: boolean | undefined
        /** showVerifyCTA: verifying would open QR pay for this user */
        verifyOpensQr: boolean
    }
    /** an advisory (future-dated) document request before its final week */
    documentSlideKey: string | null
    flags: { userInterview: boolean }
    depositAccounts: { enabled: boolean; loaded: boolean; claimable: number; active: number }
    /** newest QR pay or card spend in the latest history page; null = none seen */
    lastSpendAt: string | null
    /** a request of the user's was paid; undefined while history loads */
    hasReceivedRequestPayment: boolean | undefined
    firstPeerPaymentAt: string | null
    /** null on an API deployed before the field */
    passkeyCount: number | null
    hasEmail: boolean
    hasFullName: boolean
    /** undefined while loading; the query only runs for activated users */
    rewardsPendingUsd: number | undefined
    /** the profile's copy of the ledger (unknown shape until sanitised); undefined on an older API */
    serverLedger: unknown
    /** the arrival prompt (TASK-23251): `unknown` until this app session's check has answered */
    arrival: 'unknown' | 'none' | 'raised'
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
    /** when this device last wrote the entry; the newer device wins on the server */
    updatedAt?: string
}

export type Ledger = Partial<Record<AskId, LedgerEntry>>

export interface Session {
    slots: MountedSlot[]
    /** app loads by this user on this device (prefs.sessionCount) */
    count: number
    route: 'home' | 'other'
    interruptsThisSession: AskId[]
    /** the manager-owned interrupt on screen, kept while it stays eligible */
    openInterrupt: AskId | null
    /** a user-opened overlay or a flow in progress: nothing new opens */
    busy: boolean
    /** offline, locked, backend down: the manager pauses */
    gateUp: boolean
    /** the settle deadline passed: `unknown` no longer holds lower-priority interrupts */
    settleDeadlinePassed: boolean
}

export interface ZonePick {
    id: AskId
    /** `status` renders the pending state of an in-progress ask, not a CTA */
    mode: 'ask' | 'status'
    /** the to-do list this more critical ask replaced for now; it returns once the ask is dealt with */
    underlay?: AskId
}

export interface Decision {
    interrupt: AskId | null
    zone: ZonePick | null
    inline: { id: AskId; slot: SlotId } | null
    banner: AskId | null
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
