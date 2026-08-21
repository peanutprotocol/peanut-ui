/**
 * Types for the /dev/journey Activation Journey Explorer.
 *
 * Two halves:
 *  - In-app surface catalog types (data lives in journeyData.ts, transcribed
 *    from the activation journey UI inventory with source-file annotations).
 *  - Live API spec types, mirroring peanut-api-ts GET /__dev/journey-spec and
 *    /__dev/journey-inspect (feat/unsubscribe-analytics, api PR #1234).
 */

export type FunnelStateId =
    | 'no-access'
    | 'access-pre-kyc'
    | 'kycd-no-card'
    | 'application-in-flight'
    | 'card-active-unfunded'
    | 'funded-no-spend'
    | 'spent'

export type SurfaceKind = 'step' | 'carousel' | 'modal' | 'card-screen'

/**
 * How much of the machinery the board exposes. `product` reads as a cockpit
 * (copy + flow only); `dev` adds gating predicates, source files and event types.
 */
export type JourneyViewMode = 'product' | 'dev'

export interface InAppSurface {
    id: string
    kind: SurfaceKind
    /** Display name of the surface. */
    name: string
    /** Verbatim copy snippet the user sees. */
    copy: string
    /** CTA label → destination, when the surface has one. */
    cta?: { label: string; dest: string }
    /** When this surface renders (plain-language condition). */
    condition: string
    /** Source file(s), repo-relative — the drift-tracing anchor. */
    sourceFile: string
    /** Funnel columns this surface appears in. */
    states: FunnelStateId[]
    /** Shipped on this very branch (PR #2475). */
    isNewInThisPr?: boolean
    note?: string
}

export interface JourneyFinding {
    id: number
    title: string
    detail: string
    sourceFiles: string[]
}

export interface FunnelState {
    id: FunnelStateId
    label: string
    description: string
    /** Lifecycle-machine stage names (from the API spec) whose emails land here. */
    specStages: string[]
    /** The signup welcome email fires on entry to this column. */
    includesWelcome?: boolean
    /** The kyc.reminder push (spec.pushReminders) applies in this column. */
    includesPushReminder?: boolean
    /** Why the email machine is silent here, when specStages is empty. */
    noEmailReason?: string
}

// ---------- live API spec (GET /__dev/journey-spec) ----------

export interface SpecEmailStep {
    type: string
    afterDaysStuck?: number
    subject: string
    preview: string
    title: string
    paragraphs: string[]
    ctaText: string
    ctaPath: string
    paragraphsWithRewards?: string[]
}

export interface SpecStage {
    stage: string
    order: number
    predicate: string
    steps: SpecEmailStep[]
}

export interface SpecRules {
    /** Per-step delay from the stage anchor, by index (lifecycle v2 — stages have 2 or 3 steps). */
    stepAfterDays: number[]
    governorDays: number
    freshnessDays: number
    /** Weeks-worth of silence (in days) before a formerly-transacting user is win_back-eligible. */
    dormancyDays: number
    holdoutFraction: number
    sendWindowUtc: { startHour: number; endHour: number }
    maxSendsPerCycle: number
    maxSendsPerDay: number
}

export interface SpecPushReminder {
    type: string
    channels: string[]
    afterMinutes: number
    title: string
    note: string
}

export interface JourneySpec {
    generatedFrom: string
    rules: SpecRules
    welcome: SpecEmailStep
    stages: SpecStage[]
    pushReminders: SpecPushReminder[]
    emailPreviewBase: string
}

// ---------- copy review (email renders awaiting a product verdict) ----------

/**
 * One `?example=N` of an email. Most lifecycle emails render a single example;
 * the two first_spend steps render a second one for the rewards branch.
 */
export interface EmailExample {
    index: number
    /** Human label for the variant toggle ("plain" / "rewards"). */
    label: string
}

/** One reviewable email render — an (email, example) pair, in board order. */
export interface EmailRenderRef {
    /** `${eventType}#${example}` — the localStorage verdict key. */
    id: string
    eventType: string
    example: number
    exampleLabel: string
    step: SpecEmailStep
}

/** An open product decision attached to an email, surfaced as a chip on its card. */
export interface EmailDecisionFlag {
    /** Chip text — imperative, so the board reads as a to-do list. */
    label: string
    /** One line explaining what is actually being decided. */
    note: string
}

// ---------- live user inspector (GET /__dev/journey-inspect?username=…|userId=…) ----------

export interface InspectDue {
    userId: string
    type: string
    hasPendingRewards?: boolean
    skip?: 'holdout' | 'governor' | 'balance'
}

export interface InspectHistoryRow {
    eventType: string
    channel: string
    status: string
    skipReason: string | null
    sentAt: string | null
    createdAt: string
}

export interface JourneyInspectResponse {
    /** The resolved user — the API 404s instead of returning a null user. */
    user: {
        userId: string
        username: string | null
        email: string | null
        createdAt: string
        cardAccessGrantedAt: string | null
    }
    due: InspectDue | null
    history: InspectHistoryRow[]
}
