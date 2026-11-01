/**
 * Capability-gate state machine — the FE's single primitive for "can the user
 * do {op} (in this scope)? If not, what's blocking, and what unlocks them?"
 *
 * Replaces `deriveBridgeGate` (provider-named, bank-only) with a provider-blind
 * primitive scoped by operation + an optional filter (channel/country/method/
 * railId). Every UI site that used to do `hasEnabledRail('bridge')` /
 * `railsForProvider('bridge')` / `deriveBridgeGate(...)` collapses onto
 * `useGate(op, scope)` (the React hook) or `deriveGate(state, op, scope)` (this
 * pure function, for tests + non-React callers).
 *
 * The answer is the API's feature report (`capabilities.features`, B5): the
 * gate picks the entry its scope names and says it in the gate's words. It
 * ranks no rails and reads no identity of its own.
 */

import type {
    NextAction,
    RailCapability,
    RailOperation,
    CapabilityReason,
    RailChannel,
    ResolvedRail,
    FeatureReport,
    FeatureReportEntry,
} from '@/types/capabilities'
import type { IUserProfile } from '@/interfaces/interfaces'
import { entryAction, reportEntry, UNKNOWN_REPORT, VERIFY_ACTION } from '@/features/kyc-features/report'

/**
 * A non-blocking advisory pre-empt riding on a `ready` gate. An ENABLED rail can
 * carry a future-dated requirement (Bridge's `future_requirements[].effective_date`,
 * surfaced as a `hintAction` whose NextAction has an `effectiveDate`). The rail
 * stays usable; the FE offers a SKIPPABLE "complete before {date}" prompt. When
 * the date passes the BE reclassifies it to blocking and the gate becomes
 * `fixable-rejection` on its own — no FE date logic, no hardcoded cutover.
 */
export interface GateAdvisory {
    /** ISO date the requirement becomes blocking. */
    effectiveDate: string
    /** the NextAction `key` to start (POST /users/kyc/start-action) if the user completes it now. */
    actionKey: string
    /** which requirement — telemetry / FE branching. */
    requirementKey?: string
}

/**
 * Normalized gate state. Discriminated union — consumers branch on `kind`.
 *
 * Mapping from the old `BridgeGateAction`:
 *   accept_tos        → accept-tos        (now carries `tosUrl`)
 *   fixable_rejection → fixable-rejection
 *   blocked_rejection → blocked-rejection
 *   needs_kyc         → needs-identity    (renamed for semantic accuracy)
 *   needs_enrollment  → needs-enrollment
 *   ready             → ready
 *   loading           → loading
 *   (new)             → pending             (BE working — surface explicitly)
 *   (new)             → waiting-on-provider (provider doing internal review,
 *                                            no user action — distinct from
 *                                            our `pending` which is in-flight
 *                                            provisioning. Sourced from a rail
 *                                            with a `kind: 'wait'` NextAction.)
 */
export type GateState =
    | { kind: 'loading' }
    | { kind: 'ready'; advisory?: GateAdvisory }
    | { kind: 'pending'; userMessage?: string | null; reason?: CapabilityReason }
    | {
          kind: 'waiting-on-provider'
          userMessage: string | null
          reason?: CapabilityReason
          pendingSince?: string
          railId?: string
      }
    | { kind: 'accept-tos'; tosUrl?: string; userMessage: string | null; reason?: CapabilityReason }
    /**
     * `actionKey` is the Sumsub level the backend named for this fix. Call sites
     * hand it to `handleFixableRejection` together with `reason.code`, which is
     * what lets a residence park open the address step instead of the generic
     * resubmit route that 404s for it (TASK-22286).
     */
    | {
          kind: 'fixable-rejection'
          userMessage: string | null
          reason?: CapabilityReason
          actionKey?: string
          nextAction?: NextAction
      }
    | { kind: 'blocked-rejection'; userMessage: string | null; reason?: CapabilityReason }
    /**
     * Blocked rail with a self-fix path: re-verify Sumsub IDENTITY with a
     * different document. Triggered today for Manteca country-ineligibility
     * (user uploaded a non-AR/BR doc on a flow that only supports those).
     * CTA opens a fresh Sumsub WebSDK after POST /users/identity/restart.
     */
    | { kind: 'restart-identity'; userMessage: string | null; reason?: CapabilityReason }
    /**
     * Blocked rail whose pipeline failure is self-serviceable: no email was
     * ever captured, so provider submission couldn't run. CTA opens an email
     * form; on save the BE flips the rails back to PENDING and resubmits.
     */
    | { kind: 'provide-email'; userMessage: string | null; reason?: CapabilityReason }
    | { kind: 'needs-identity' }
    | { kind: 'needs-enrollment' }

/**
 * Scope a gate query to a subset of rails. Combine freely:
 *   {}                                       — every rail
 *   { channel: 'bank' }                      — every bank rail (provider-blind)
 *   { country: 'AR' }                        — every rail for Argentina
 *   { channel: 'bank', country: 'AR' }       — bank rails in AR (Manteca's PIX_BR + BANK_TRANSFER_AR)
 *   { method: 'ACH_US' }                     — that specific method
 *   { railId: 'bridge.ach_us' }              — that specific rail (single-shot)
 */
export interface GateScope {
    channel?: RailChannel
    country?: string
    method?: string
    railId?: string
}

/** Filter a rail list by scope. Pure. */
export function filterRailsByScope(rails: RailCapability[], scope: GateScope = {}): RailCapability[] {
    return rails.filter((rail) => {
        if (scope.railId && rail.id !== scope.railId) return false
        if (scope.channel && rail.channel !== scope.channel) return false
        if (scope.country && rail.country !== scope.country) return false
        if (scope.method && rail.method !== scope.method) return false
        return true
    })
}

/** Resolve a rail's blocking actions to NextAction descriptors. */
function railActions(rail: RailCapability, byKey: Map<string, NextAction>): NextAction[] {
    return (rail.blockingActions ?? [])
        .map((key) => byKey.get(key))
        .filter((action): action is NextAction => action !== undefined)
}

/** Resolve a rail's HINT (non-blocking) actions to NextAction descriptors. */
function railHintActions(rail: RailCapability, byKey: Map<string, NextAction>): NextAction[] {
    return (rail.hintActions ?? [])
        .map((key) => byKey.get(key))
        .filter((action): action is NextAction => action !== undefined)
}

/**
 * The per-rail verdict the gate branches on. The BE's `resolved` field is the
 * single source of truth (derived server-side from the same emission as the
 * legacy fields, so it can never disagree with them); rails from an older BE
 * or a cached response fall back to a local collapse that reproduces the OLD
 * ladder's per-rail semantics. Delete the fallback when the BE's step-5
 * cleanup makes `resolved` guaranteed.
 *
 * Fallback rules (status first — action kinds only refine WITHIN a status,
 * mirroring the pre-verdict ladder):
 *   - enabled/pending pass through (the advisory hint rides as nextAction)
 *   - blocked: provide-email action → fixable/provide-email (self-serve);
 *     restart-identity action → blocked/restart-identity (the ladder splits
 *     the CTA on the FIRST blocked rail only); anything else → blocked —
 *     a stale sumsub/tos/wait action on a blocked rail must NOT resurrect a
 *     self-heal CTA the old gate never offered.
 *   - requires-info: wait-only → pending+wait; a restart-identity action →
 *     blocked/restart-identity, as for a blocked rail (the API's own verdict);
 *     another non-wait self-serve action →
 *     fixable with that action; actionless or contact-support-only → fixable
 *     WITHOUT a nextAction (the old 7b document-punt tier, ranked below
 *     pending in the ladder).
 *
 * Exported so every verdict consumer (provider-rejection.utils, qr-pay,
 * ActivationCTAs) shares ONE collapse instead of hand-rolling diverging copies.
 */
export function railVerdict(rail: RailCapability, byKey: Map<string, NextAction>): ResolvedRail {
    if (rail.resolved) return rail.resolved

    if (rail.status === 'enabled' || rail.status === 'pending') {
        // an enabled rail's advisory hint rides as the verdict's nextAction
        // (the BE emits at most one hint per rail)
        const hint = railHintActions(rail, byKey)[0]
        return { status: rail.status, ...(hint ? { nextAction: hint } : {}) }
    }

    const actions = railActions(rail, byKey)
    const blocking = (selfHealable: boolean, selfHealKind?: NonNullable<ResolvedRail['blocking']>['selfHealKind']) => ({
        code: rail.reason?.code ?? 'unknown',
        userMessage: rail.reason?.userMessage ?? '',
        selfHealable,
        ...(selfHealKind ? { selfHealKind } : {}),
        ...(rail.reason?.details ? { details: rail.reason.details } : {}),
    })

    if (rail.status === 'blocked') {
        const email = actions.find((action) => action.kind === 'provide-email')
        if (email) return { status: 'fixable', blocking: blocking(true, 'provide-email'), nextAction: email }
        const restart = actions.find((action) => action.kind === 'restart-identity')
        if (restart) return { status: 'blocked', blocking: blocking(true, 'restart-identity'), nextAction: restart }
        return { status: 'blocked', blocking: blocking(false, 'contact-support') }
    }

    // requires-info: an actionable step outranks a wait marker on the same rail
    const nextAction = actions.find((action) => action.kind !== 'wait') ?? actions[0]
    if (nextAction?.kind === 'wait') return { status: 'pending', nextAction }
    // A provider asking for a new ID parks the rail as a step (Manteca's ID task); the API's verdict is the restart.
    if (nextAction?.kind === 'restart-identity')
        return { status: 'blocked', blocking: blocking(true, 'restart-identity'), nextAction }
    if (nextAction && nextAction.kind !== 'contact-support') {
        const selfHealKind =
            nextAction.kind === 'sumsub'
                ? ('document-resubmit' as const)
                : nextAction.kind === 'provide-email'
                  ? ('provide-email' as const)
                  : undefined
        return { status: 'fixable', blocking: blocking(true, selfHealKind), nextAction }
    }
    // actionless (or contact-support-only): the document-punt tier — the BE
    // routes these through the resubmit endpoint without a capability action;
    // NO nextAction on the verdict, which is what ranks it below pending
    return { status: 'fixable', blocking: blocking(true, 'document-resubmit') }
}

/**
 * Whether a blocked rail is terminal: nothing the user does can unblock it,
 * and support is the only door.
 *
 * `blocked` with a restart-identity action is not terminal — the user can
 * verify again with another document. Everything else that reaches `blocked`
 * carries `selfHealKind: 'contact-support'` and `selfHealable: false`.
 *
 * Screens that offer a retry must ask this first. The unlock-payments surface
 * offered "Try again" to a user whose retry could never succeed, while Add
 * money told the same user "Not available" and Withdraw sent them to support.
 */
export function isTerminalRailRejection(rail: RailCapability, byKey: Map<string, NextAction>): boolean {
    if (rail.status !== 'blocked') return false
    const verdict = railVerdict(rail, byKey)
    return verdict.status === 'blocked' && verdict.blocking?.selfHealKind !== 'restart-identity'
}

/**
 * The user-facing message for a rail: verdict copy first (single BE source),
 * legacy reason as fallback. Exported for the non-gate verdict consumers.
 */
export function railUserMessage(rail: RailCapability): string | null {
    return rail.resolved?.blocking?.userMessage || rail.reason?.userMessage || null
}

/**
 * Purposes the Manteca cap-nudge is emitted under (peanut-api-ts
 * `kyc/capabilities/resolver.ts`). A full-tier Manteca rail that recently hit
 * its monthly cap carries the marker as a `hintAction`; once the user submits
 * the source-of-funds document the marker gains `submittedAt` and the hint
 * becomes a `wait`.
 */
const CAP_NUDGE_RAISE_PURPOSE = 'raise-manteca-limit'
const CAP_NUDGE_REVIEW_PURPOSE = 'manteca-limit-under-review'

/**
 * The source-of-funds RFI the cap-nudge starts. Identified by key/level as well
 * as purpose because the BE's action key is NOT provider-namespaced: Bridge
 * emits the same `sumsub:source_of_funds` for its own source-of-funds
 * requirement, and the resolver's `upsertAction` keeps whichever rail emits
 * FIRST. A user carrying both a Bridge SoF requirement and a Manteca cap-nudge
 * can therefore end up with the Manteca rail pointing at a descriptor whose
 * purpose reads `unlock-bridge` — and a purpose-only check would drop the real
 * nudge and leave exactly that cohort with no limit-raise route, which is the
 * hole this whole selector exists to close.
 */
const CAP_NUDGE_RAISE_KEY = 'sumsub:source_of_funds'
const CAP_NUDGE_RAISE_LEVEL = 'source_of_funds'

/**
 * The Manteca cap-nudge, if the user is carrying one.
 *
 *   - `raise`        — a fresh cap block. `actionKey` starts the source-of-funds
 *                      Sumsub flow (POST /users/kyc/start-action).
 *   - `under-review` — the document is in, but Sumsub accepting it does NOT mean
 *                      Manteca raised the cap (that is still a manual support
 *                      step). Non-actionable by construction: no key to start.
 */
export type MantecaCapNudge = { state: 'raise'; actionKey: string } | { state: 'under-review' }

/**
 * Select the Manteca cap-nudge from the capability block.
 *
 * Deliberately NOT routed through {@link firstAdvisory}: that selector ranks
 * Bridge's future-dated requirements by `effectiveDate`, and the cap-nudge has
 * no date to rank by — it is already due. Loosening the date requirement there
 * would push the nudge into the add-money/withdraw pre-empt modal, interrupting
 * a payment to advertise a limit raise. This is its own read, consumed by the
 * limits page.
 *
 * A fresh block outranks an in-review sibling: re-seeding the marker (a NEW cap
 * block after a completed RFI) must restore the actionable CTA rather than leave
 * the user staring at a stale "under review".
 *
 * Both branches are pinned to the action `kind` the FE can actually honour, so a
 * future BE that re-purposes either key cannot make the review state tappable.
 */
export function selectMantecaCapNudge(rails: RailCapability[], nextActions: NextAction[]): MantecaCapNudge | undefined {
    const byKey = new Map(nextActions.map((action) => [action.key, action]))
    let underReview = false

    for (const rail of rails) {
        if (rail.provider !== 'manteca') continue
        // The verdict's nextAction is the BE-derived carrier on an enabled rail;
        // `hintActions` is the legacy one. Read both — same dual-source rule as
        // railVerdict — so neither an older nor a newer BE drops the nudge.
        const candidates = [...railHintActions(rail, byKey), rail.resolved?.nextAction]
        for (const action of candidates) {
            if (!action) continue
            // Rail-LOCAL identification. These come from a Manteca rail's own
            // hint list, and Bridge requirements ride Bridge rails' blocking
            // actions — so a source-of-funds RFI reached from here is the cap
            // nudge whatever purpose the deduped descriptor ended up carrying.
            const isSourceOfFunds =
                action.purpose === CAP_NUDGE_RAISE_PURPOSE ||
                action.key === CAP_NUDGE_RAISE_KEY ||
                action.levelKey === CAP_NUDGE_RAISE_LEVEL
            if (action.kind === 'sumsub' && isSourceOfFunds) {
                return { state: 'raise', actionKey: action.key }
            }
            if (action.kind === 'wait' && action.purpose === CAP_NUDGE_REVIEW_PURPOSE) underReview = true
        }
    }

    return underReview ? { state: 'under-review' } : undefined
}

/**
 * Input state for the pure derive. Held separately from the React hook so the
 * gate is independently testable (and re-usable from non-React callers).
 */
export interface CapabilityState {
    rails: RailCapability[]
    nextActions: NextAction[]
    /** The API's feature report: the gate's one answer. Absent until the API sends it. */
    features?: FeatureReport
    /** True until the user query settles. Holds the gate in 'loading'. */
    isLoading: boolean
}

/**
 * Blocks only a person can lift, so no verify, restart or email step is ever
 * offered for them (TASK-24046):
 *
 *   duplicate-account — this account's email belongs to another Peanut
 *                       account; support moves or merges the accounts. Older
 *                       APIs only label the identity check `DUPLICATE_EMAIL`.
 *   imported-identity — an identity imported from Bridge that Peanut never
 *                       reviewed, whose ID Bridge has since rejected.
 *
 * The API names each with a reason code (on a rail or on the identity) or a
 * contact-support action of the matching purpose.
 */
export type SupportCase = 'duplicate-account' | 'imported-identity'

export const DUPLICATE_ACCOUNT_REASON_CODE = 'duplicate_account'
export const IMPORTED_IDENTITY_REJECTED_CODE = 'imported_identity_rejected'
export const SUPPORT_CASE_REASON_CODES: Record<SupportCase, string> = {
    'duplicate-account': DUPLICATE_ACCOUNT_REASON_CODE,
    'imported-identity': IMPORTED_IDENTITY_REJECTED_CODE,
}
// reason codes and action purposes, `-` read as `_`
const SUPPORT_CASE_MARKERS: Record<string, SupportCase> = {
    duplicate_account: 'duplicate-account',
    imported_identity_rejected: 'imported-identity',
    imported_identity_review: 'imported-identity',
}

/** The support case a reason code or action purpose names, if any. */
export function supportCaseOf(value: string | null | undefined): SupportCase | undefined {
    return value ? SUPPORT_CASE_MARKERS[value.replace(/-/g, '_')] : undefined
}

/**
 * The gate's input, read off a user profile. The hook reads the rendered
 * profile through it; a caller holding a profile it just fetched reads that
 * one through it, so both resolve the same way.
 */
export function capabilityStateForProfile(user: IUserProfile | null | undefined, isLoading: boolean): CapabilityState {
    return {
        rails: user?.capabilities?.rails ?? [],
        nextActions: user?.capabilities?.nextActions ?? [],
        features: user?.capabilities?.features,
        isLoading,
    }
}

function supportCaseGate(
    supportCase: SupportCase,
    reason: CapabilityReason | undefined,
    userMessage: string | null
): GateState {
    return {
        kind: 'blocked-rejection',
        userMessage,
        reason: { ...reason, code: SUPPORT_CASE_REASON_CODES[supportCase], userMessage: reason?.userMessage ?? '' },
    }
}

/**
 * The gate for one operation in one scope: the API's feature report entry for
 * that scope (the account a method, rail or country opens, else the feature
 * the operation is), in the gate's words. The API decides; the gate names it.
 * While the user query settles the gate stays `loading`; a report the API has
 * not sent offers nothing and refuses nothing (`pending`).
 */
export function deriveGate(state: CapabilityState, op: RailOperation, scope: GateScope = {}): GateState {
    if (state.isLoading) return { kind: 'loading' }
    return gateFromEntry(reportEntry(state.features ?? UNKNOWN_REPORT, op, scope, state.rails), state)
}

/** A report entry in the gate's words, with the action's own details (terms URL, the step to start). */
export function gateFromEntry(
    entry: FeatureReportEntry,
    { rails, nextActions }: Pick<CapabilityState, 'rails' | 'nextActions'>
): GateState {
    const action = entryAction(entry, nextActions)
    const userMessage = entry.message || null
    const reason: CapabilityReason | undefined = entry.reason
        ? { code: entry.reason, userMessage: entry.message ?? '' }
        : undefined
    switch (entry.state) {
        case 'on':
            return action?.effectiveDate
                ? {
                      kind: 'ready',
                      advisory: {
                          effectiveDate: action.effectiveDate,
                          actionKey: action.key,
                          requirementKey: action.requirementKey,
                      },
                  }
                : { kind: 'ready' }
        case 'setting_up': {
            if (action?.kind !== 'wait') return reason ? { kind: 'pending', userMessage, reason } : { kind: 'pending' }
            const railId = rails.find((rail) => rail.resolved?.nextAction?.key === action.key)?.id
            return {
                kind: 'waiting-on-provider',
                userMessage,
                reason,
                ...(entry.since ? { pendingSince: entry.since, ...(railId ? { railId } : {}) } : {}),
            }
        }
        case 'pending':
            return { kind: 'pending' }
        case 'ready':
            return { kind: 'needs-enrollment' }
        case 'action_required':
            if (entry.action === VERIFY_ACTION) return { kind: 'needs-identity' }
            if (action?.kind === 'restart-identity') return { kind: 'restart-identity', userMessage, reason }
            if (action?.kind === 'provide-email') return { kind: 'provide-email', userMessage, reason }
            if (action?.kind === 'accept-tos') return { kind: 'accept-tos', tosUrl: action.tosUrl, userMessage, reason }
            return {
                kind: 'fixable-rejection',
                userMessage,
                reason,
                ...(action ? { actionKey: action.key, nextAction: action } : {}),
            }
        case 'refused': {
            const supportCase = supportCaseOf(entry.reason)
            if (supportCase) return supportCaseGate(supportCase, reason, userMessage)
            if (action?.kind === 'restart-identity') return { kind: 'restart-identity', userMessage, reason }
            return { kind: 'blocked-rejection', userMessage, reason }
        }
    }
}

/**
 * Map a gate kind to an `InitiateKycModal` variant. Identical mapping to the
 * old `getKycModalVariant(BridgeGateAction['type'])`, just over the new kinds.
 */
export function getKycModalVariant(
    kind: GateState['kind']
): 'blocked' | 'provider_rejection' | 'cross_region' | 'restart_identity' | 'default' {
    if (kind === 'blocked-rejection') return 'blocked'
    // Floor for consumers not yet wired to render the email sheet: show the
    // contact-support variant, never the 'default' re-verify CTA (the user's
    // identity is already verified — bouncing them into Sumsub is wrong).
    if (kind === 'provide-email') return 'blocked'
    if (kind === 'restart-identity') return 'restart_identity'
    if (kind === 'fixable-rejection') return 'provider_rejection'
    if (kind === 'needs-enrollment') return 'cross_region'
    return 'default'
}

/**
 * Resolve the InitiateKycModal variant for a gate. Adds the residence refusals
 * on top of the base kind->variant map, so the add/withdraw entry points don't
 * each re-implement the check:
 *   - `uk_resident_blocked` → 'region-unavailable', whose copy names UK
 *     regulation (TASK-20729). UK only.
 *   - `residence_bank_restricted` → 'bank-unavailable', the country-neutral
 *     "not available in this country" ending (api#1738). The rail is blocked,
 *     but support cannot lift a residence rule, so it is not the contact-
 *     support 'blocked' ending, and never the UK copy.
 */
export function resolveKycModalVariant(
    gate: GateState
): ReturnType<typeof getKycModalVariant> | 'region-unavailable' | 'bank-unavailable' {
    if ('reason' in gate && gate.reason?.code === 'uk_resident_blocked') return 'region-unavailable'
    if ('reason' in gate && gate.reason?.code === 'residence_bank_restricted') return 'bank-unavailable'
    return getKycModalVariant(gate.kind)
}

/**
 * Extract the user-facing message from a gate state (was
 * `getGateProviderMessage` — but the message has never been provider-named, it's
 * `reason.userMessage` from the BE which is already user-friendly + provider-blind).
 */
export function getGateUserMessage(gate: GateState): string | undefined {
    if (
        gate.kind === 'fixable-rejection' ||
        gate.kind === 'blocked-rejection' ||
        gate.kind === 'restart-identity' ||
        gate.kind === 'provide-email' ||
        gate.kind === 'accept-tos' ||
        gate.kind === 'waiting-on-provider'
    ) {
        return gate.userMessage ?? undefined
    }
    return undefined
}

/** The advisory pre-empt riding on a `ready` gate, if present. */
export function getGateAdvisory(gate: GateState): GateAdvisory | undefined {
    return gate.kind === 'ready' ? gate.advisory : undefined
}

/**
 * The stable `CapabilityReason.code` behind a gate's message. Companion to
 * {@link getGateUserMessage}: render sites map the code onto localized copy
 * (identity.reasons.* via `reasonCodeKey`) and keep the prose as fallback.
 */
export function getGateReasonCode(gate: GateState): string | undefined {
    return 'reason' in gate ? gate.reason?.code : undefined
}

/**
 * Gates the verify step can actually DO something about. Deliberately an
 * allow-list: `pending` and `waiting-on-provider` resolve to the default
 * "Unlock now" screen, so treating them as verification would offer a fresh
 * Sumsub run to someone whose only correct move is to wait — and a gate kind
 * added later falls through to the amount step, which is where it behaved
 * before, rather than onto a screen that cannot render it.
 */
const VERIFIABLE_GATE_KINDS = new Set<GateState['kind']>([
    'needs-identity',
    'needs-enrollment',
    'fixable-rejection',
    'restart-identity',
    'blocked-rejection',
    'provide-email',
])

/** Whether the user can act on this gate themselves, rather than only wait. */
export function isVerifiableGate(kind: GateState['kind']): boolean {
    return VERIFIABLE_GATE_KINDS.has(kind)
}

/**
 * The step that resolves a gate — where its CTA must lead. The six verifiable
 * kinds are not interchangeable: sending them all to identity verification is
 * how a verified user ends up in a Sumsub run that cannot help them.
 *
 *   verify            — needs-identity: start verification (Smart Paperwork
 *                       Verification users are routed to /verify by the start)
 *   enroll            — needs-enrollment: open this corridor on the identity on file
 *   provider-fix      — fixable-rejection: the provider's own fix (resubmit or start-action)
 *   hosted-check      — fixable-rejection naming Bridge's hosted check
 *   questions         — fixable-rejection waiting on an answer: the feature's add-later questions
 *   restart-identity  — the identity check again, with another document
 *   provide-email     — the email sheet
 *   support           — blocked-rejection: nothing the user can do in the app
 */
export type GateRemedy =
    | 'none'
    | 'wait'
    | 'accept-tos'
    | 'verify'
    | 'enroll'
    | 'provider-fix'
    | 'hosted-check'
    | 'questions'
    | 'restart-identity'
    | 'provide-email'
    | 'support'

export function gateRemedy(gate: GateState): GateRemedy {
    switch (gate.kind) {
        case 'loading':
        case 'ready':
            return 'none'
        case 'pending':
        case 'waiting-on-provider':
            return 'wait'
        case 'accept-tos':
            return 'accept-tos'
        case 'needs-identity':
            return 'verify'
        case 'needs-enrollment':
            return 'enroll'
        case 'restart-identity':
            return 'restart-identity'
        case 'provide-email':
            return 'provide-email'
        case 'blocked-rejection':
            return 'support'
        case 'fixable-rejection':
            if (gate.nextAction?.kind === 'questions' && gate.nextAction.feature) return 'questions'
            return gate.nextAction?.kind === 'bridge-hosted' ? 'hosted-check' : 'provider-fix'
    }
}

/** The support case behind a blocked gate, if it is one. */
export function gateSupportCase(gate: GateState): SupportCase | undefined {
    return gate.kind === 'blocked-rejection' ? supportCaseOf(gate.reason?.code) : undefined
}

export type DepositStep = 'verify' | 'inputAmount' | 'showDetails'

/**
 * The step a deposit flow belongs on, or `null` to leave it where it is.
 *
 * Verification comes before the amount: asking for a number and only then
 * revealing an ID check wastes the entry, and a user who cannot pass the check
 * should never have typed one. This runs on every gate change, not only at
 * entry, so a bookmarked `?step=inputAmount` cannot walk around the ordering
 * and a cleared gate does not strand anyone on a requirement they have met.
 *
 * Two states it must not touch: a gate that has not resolved (entering on the
 * amount and then jumping would flash the wrong screen), and `showDetails`,
 * which is a live onramp with a transfer id behind it.
 *
 * `accept-tos` is not an identity check. It is a one-tap consent the amount
 * step already guards inline, so it does not earn a screen of its own.
 * `provide-email` is the same: one field the amount step opens as a sheet,
 * where the verify screen could only offer support.
 */
/**
 * Whether a deposit step may render yet.
 *
 * A persisted `?step=verify` is not evidence the user needs verifying — a
 * `pending` user can reload one. Nothing renders until the gate has answered
 * AND the step matches that answer, because either gap puts the default
 * "Unlock now" screen on the page with a live CTA that would start a Sumsub
 * run for someone whose gate only time can clear.
 *
 * `showDetails` is exempt: it is a live onramp holding its own transfer id, and
 * does not read the gate at all.
 */
export function isDepositStepReady(current: DepositStep | null | undefined, gateKind: GateState['kind']): boolean {
    if (current === 'showDetails') return true
    // Answered is not enough — the step must be the one the answer calls for.
    // Effects run after paint, so a step the effect is about to rewrite still
    // gets a frame on screen: long enough on a slow device to tap an "Unlock
    // now" that the real gate never offered.
    return gateKind !== 'loading' && nextDepositStep(current, gateKind) === null
}

export function nextDepositStep(
    current: DepositStep | null | undefined,
    gateKind: GateState['kind']
): 'verify' | 'inputAmount' | null {
    if (gateKind === 'loading') return null
    if (current === 'showDetails') return null
    const target = isVerifiableGate(gateKind) && gateKind !== 'provide-email' ? 'verify' : 'inputAmount'
    return current === target ? null : target
}
