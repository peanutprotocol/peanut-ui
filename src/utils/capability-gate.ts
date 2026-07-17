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
 * Identity vs rail-approval (semantic fix from CodeRabbit on
 * Profile/ProfileEdit): the gate's "identity verified" precondition is now
 * `identityVerification.status === 'verified'` (Sumsub-cleared the human),
 * NOT `isKycApproved` (any rail enabled — which falsely flips for card-only or
 * pool-tier users).
 */

import type {
    NextAction,
    RailCapability,
    RailOperation,
    CapabilityReason,
    RailChannel,
    ResolvedRail,
} from '@/types/capabilities'

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
    | { kind: 'pending' }
    | { kind: 'waiting-on-provider'; userMessage: string | null; reason?: CapabilityReason }
    | { kind: 'accept-tos'; tosUrl?: string; userMessage: string | null; reason?: CapabilityReason }
    | { kind: 'fixable-rejection'; userMessage: string | null; reason?: CapabilityReason }
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

/** Read operation status with rail-level fallback (per the contract's `operations?.[op] ?? status` semantics). */
function operationStatus(rail: RailCapability, op: RailOperation): RailCapability['status'] {
    return rail.operations?.[op] ?? rail.status
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
 *   - requires-info: wait-only → pending+wait; a non-wait self-serve action →
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
    if (nextAction && nextAction.kind !== 'contact-support') {
        const selfHealKind =
            nextAction.kind === 'sumsub'
                ? ('document-resubmit' as const)
                : nextAction.kind === 'provide-email'
                  ? ('provide-email' as const)
                  : nextAction.kind === 'restart-identity'
                    ? ('restart-identity' as const)
                    : undefined
        return { status: 'fixable', blocking: blocking(true, selfHealKind), nextAction }
    }
    // actionless (or contact-support-only): the document-punt tier — the BE
    // routes these through the resubmit endpoint without a capability action;
    // NO nextAction on the verdict, which is what ranks it below pending
    return { status: 'fixable', blocking: blocking(true, 'document-resubmit') }
}

/** verdict-carrying candidate — computed once per derive, shared across branches */
interface RailWithVerdict {
    rail: RailCapability
    verdict: ResolvedRail
}

/**
 * The user-facing message for a rail: verdict copy first (single BE source),
 * legacy reason as fallback. Exported for the non-gate verdict consumers.
 */
export function railUserMessage(rail: RailCapability): string | null {
    return rail.resolved?.blocking?.userMessage || rail.reason?.userMessage || null
}

/** message helper over a computed candidate (avoids re-deriving inside the ladder) */
function verdictMessage({ rail, verdict }: RailWithVerdict): string | null {
    return verdict.blocking?.userMessage || rail.reason?.userMessage || null
}

/**
 * The most-urgent advisory pre-empt among the given (ready) rails — the
 * verdict nextAction carrying the earliest `effectiveDate`. Returns undefined
 * when no rail has a future-dated hint.
 */
function firstAdvisory(candidates: RailWithVerdict[]): GateAdvisory | undefined {
    let best: NextAction | undefined
    for (const { verdict } of candidates) {
        const action = verdict.nextAction
        if (!action?.effectiveDate) continue
        if (!best || action.effectiveDate < best.effectiveDate!) best = action
    }
    if (!best) return undefined
    return { effectiveDate: best.effectiveDate!, actionKey: best.key, requirementKey: best.requirementKey }
}

/**
 * Input state for the pure derive. Held separately from the React hook so the
 * gate is independently testable (and re-usable from non-React callers).
 */
export interface CapabilityState {
    rails: RailCapability[]
    nextActions: NextAction[]
    /** identityVerification.status === 'verified' — NOT any-rail-enabled. */
    identityVerified: boolean
    /** True until the user query settles. Holds the gate in 'loading'. */
    isLoading: boolean
}

/**
 * Pure gate derivation over the per-rail VERDICT (`rail.resolved`, BE-derived;
 * legacy fallback in {@link railVerdict}). The gate no longer re-derives
 * fixable-vs-terminal from reason codes + action kinds — it renders the
 * verdict. Priority order is unchanged from the pre-verdict gate:
 *
 *   1. loading             — capability state not yet settled
 *   2. ready               — at least one in-scope rail has operationStatus(op) === 'enabled'
 *                            (per-op refinement stays FE-side: the verdict is rail-level).
 *                            Hoisted above every blocker so a working rail (e.g. Manteca
 *                            PIX_BR ENABLED) wins over stuck sibling rails — the
 *                            2026-06-01 Alexandre incident guard.
 *   3. provide-email       — any verdict with selfHealKind 'provide-email': a USER-level
 *                            fix (one email unblocks every email-blocked rail), so it
 *                            outranks terminal siblings.
 *   4. restart-identity    — verdict selfHealKind 'restart-identity' (self-fix by
 *                            re-verifying with a different document).
 *   5. blocked-rejection   — any verdict status 'blocked' (terminal, contact support).
 *   6. accept-tos          — fixable verdict whose nextAction is `accept-tos`.
 *   7. fixable-rejection   — any other fixable verdict (document resubmit / RFI).
 *   8. pending             — verdict 'pending' without a wait marker (we're provisioning).
 *   9. waiting-on-provider — only wait-marked pending verdicts remain (provider is
 *                            reviewing; no user action). Above needs-identity so the
 *                            user sees "we're checking", not a misleading re-verify CTA.
 *  10. needs-identity      — no functional rail in scope AND identity not verified
 *  11. needs-enrollment    — no functional rail in scope BUT identity verified
 */
export function deriveGate(state: CapabilityState, op: RailOperation, scope: GateScope = {}): GateState {
    if (state.isLoading) return { kind: 'loading' }

    const actionByKey = new Map(state.nextActions.map((action) => [action.key, action]))
    const candidates: RailWithVerdict[] = filterRailsByScope(state.rails, scope).map((rail) => ({
        rail,
        verdict: railVerdict(rail, actionByKey),
    }))

    // 2. ready — per-op refinement wins over rail-level status.
    const readyRails = candidates.filter(({ rail }) => operationStatus(rail, op) === 'enabled')
    if (readyRails.length > 0) {
        // A working rail can still carry a future-dated requirement as a
        // non-blocking hint — surface it as a SKIPPABLE pre-empt without
        // demoting `ready` (the rail is usable now).
        const advisory = firstAdvisory(readyRails)
        return advisory ? { kind: 'ready', advisory } : { kind: 'ready' }
    }

    // 3. provide-email
    const emailFix = candidates.find(({ verdict }) => verdict.blocking?.selfHealKind === 'provide-email')
    if (emailFix) {
        return { kind: 'provide-email', userMessage: verdictMessage(emailFix), reason: emailFix.rail.reason }
    }

    // 4. blocked family — decided on the FIRST blocked verdict in scope, so an
    // account-wide terminal block wins over a sibling's restart-identity CTA
    // (re-verifying cannot unblock a terminal rail and burns Sumsub attempts).
    const blocked = candidates.find(({ verdict }) => verdict.status === 'blocked')
    if (blocked) {
        if (blocked.verdict.blocking?.selfHealKind === 'restart-identity') {
            return { kind: 'restart-identity', userMessage: verdictMessage(blocked), reason: blocked.rail.reason }
        }
        return { kind: 'blocked-rejection', userMessage: verdictMessage(blocked), reason: blocked.rail.reason }
    }

    const fixables = candidates.filter(({ verdict }) => verdict.status === 'fixable')

    // 5. accept-tos
    const tos = fixables.find(({ verdict }) => verdict.nextAction?.kind === 'accept-tos')
    if (tos) {
        return {
            kind: 'accept-tos',
            tosUrl: tos.verdict.nextAction?.tosUrl,
            userMessage: verdictMessage(tos),
            reason: tos.rail.reason,
        }
    }

    // 6. fixable with a concrete action (Sumsub RFI / restart) — the user has a
    // step to take now, so it outranks provisioning
    const actionableFixable = fixables.find(({ verdict }) => verdict.nextAction !== undefined)
    if (actionableFixable) {
        return {
            kind: 'fixable-rejection',
            userMessage: verdictMessage(actionableFixable),
            reason: actionableFixable.rail.reason,
        }
    }

    // 7. pending — BE is provisioning, no user action needed
    const hasPending = candidates.some(
        ({ verdict }) => verdict.status === 'pending' && verdict.nextAction?.kind !== 'wait'
    )
    if (hasPending) return { kind: 'pending' }

    // 8. action-less fixable (the document-punt tier): completable via the
    // resubmit endpoint but with nothing concrete to click — ranked below
    // pending (matches the old 7b placement: mid-provisioning wins).
    if (fixables.length > 0) {
        return { kind: 'fixable-rejection', userMessage: verdictMessage(fixables[0]), reason: fixables[0].rail.reason }
    }

    // 9. waiting-on-provider — only wait-marked verdicts remain in scope
    const waiting = candidates.find(
        ({ verdict }) => verdict.status === 'pending' && verdict.nextAction?.kind === 'wait'
    )
    if (waiting) {
        return { kind: 'waiting-on-provider', userMessage: verdictMessage(waiting), reason: waiting.rail.reason }
    }

    // 10/11. no functional rail in scope. Distinguish identity-not-cleared vs
    // identity-cleared-but-no-rail-for-this-scope (needs enrollment / cross-region).
    if (!state.identityVerified) return { kind: 'needs-identity' }
    return { kind: 'needs-enrollment' }
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
