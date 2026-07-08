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

import type { NextAction, RailCapability, RailOperation, CapabilityReason, RailChannel } from '@/types/capabilities'

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
 * The most-urgent advisory pre-empt among the given (ready) rails — the
 * hintAction whose NextAction carries the earliest `effectiveDate`. Returns
 * undefined when no rail has a future-dated hint.
 */
function firstAdvisory(rails: RailCapability[], byKey: Map<string, NextAction>): GateAdvisory | undefined {
    let best: NextAction | undefined
    for (const rail of rails) {
        for (const action of railHintActions(rail, byKey)) {
            if (!action.effectiveDate) continue
            if (!best || action.effectiveDate < best.effectiveDate!) best = action
        }
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
 * Pure gate derivation. Same priority order as the old `deriveBridgeGate`,
 * generalized over scope + operation.
 *
 * Priority (highest first):
 *   1. loading             — capability state not yet settled
 *   2. ready               — at least one in-scope rail has operationStatus(op) === 'enabled'.
 *                            Hoisted to position 2 so a working rail (e.g. Manteca PIX_BR
 *                            ENABLED) wins over stuck sibling rails (e.g. Bridge ACH_US
 *                            terms_of_service_v2). The 2026-06-01 Alexandre incident
 *                            (BR user blocked by Bridge ToS modal while their Manteca
 *                            PIX_BR was ENABLED) was the latest customer-visible failure
 *                            of the prior 'gate any sibling blocker first' order.
 *   3. blocked-rejection   — any in-scope rail status: 'blocked', and no ready rail
 *   4. accept-tos          — requires-info + a `kind: 'accept-tos'` action
 *                            (user-actionable, unblocks the scope)
 *   5. fixable-rejection   — requires-info + a `kind: 'sumsub'` action
 *                            (user-actionable, unblocks the scope)
 *   6. pending             — at least one in-scope rail status === 'pending' (we're provisioning)
 *   7. waiting-on-provider — only requires-info rails AND every one has only
 *                            `kind: 'wait'` actions (e.g. Bridge internal KYC
 *                            review, post_processing, generic stripe lookup).
 *                            Placed BELOW `ready` / `pending` so a ready rail
 *                            wins — if the user has another rail they can use
 *                            or is mid-provisioning, surface that instead.
 *                            Placed ABOVE `needs-identity` / `needs-enrollment`
 *                            so the user sees "we're checking" instead of a
 *                            misleading "verify your identity" CTA.
 *   8. needs-identity      — no functional rail in scope AND identity not verified
 *   9. needs-enrollment    — no functional rail in scope BUT identity verified
 */
export function deriveGate(state: CapabilityState, op: RailOperation, scope: GateScope = {}): GateState {
    if (state.isLoading) return { kind: 'loading' }

    const candidates = filterRailsByScope(state.rails, scope)
    const actionByKey = new Map(state.nextActions.map((action) => [action.key, action]))

    // 2. ready — per-op refinement wins over rail-level status. Hoisted
    // above blocked / accept-tos / fixable-rejection because the user has
    // a working path; a blocked sibling rail (different currency, KYC
    // remediation pending) is not the user's problem right now.
    const readyRails = candidates.filter((rail) => operationStatus(rail, op) === 'enabled')
    if (readyRails.length > 0) {
        // A working rail can still carry a future-dated requirement as a
        // non-blocking hint — surface it as a SKIPPABLE pre-empt without
        // demoting `ready` (the rail is usable now).
        const advisory = firstAdvisory(readyRails, actionByKey)
        return advisory ? { kind: 'ready', advisory } : { kind: 'ready' }
    }

    // 3. blocked — split: if the rail carries a `restart-identity` action the
    // user can self-fix by re-verifying with a different document; otherwise
    // the only path is contact-support.
    // provide-email is a USER-level fix (one email unblocks every email-blocked
    // rail), so any blocked rail carrying it wins over an earlier blocked rail
    // with a terminal reason — .find() order must not shadow the self-serve path.
    const emailBlocked = candidates.find(
        (rail) =>
            rail.status === 'blocked' &&
            railActions(rail, actionByKey).some((action) => action.kind === 'provide-email')
    )
    if (emailBlocked) {
        return {
            kind: 'provide-email',
            userMessage: emailBlocked.reason?.userMessage ?? null,
            reason: emailBlocked.reason,
        }
    }
    const blocked = candidates.find((rail) => rail.status === 'blocked')
    if (blocked) {
        const hasRestart = railActions(blocked, actionByKey).some((action) => action.kind === 'restart-identity')
        if (hasRestart) {
            return {
                kind: 'restart-identity',
                userMessage: blocked.reason?.userMessage ?? null,
                reason: blocked.reason,
            }
        }
        return {
            kind: 'blocked-rejection',
            userMessage: blocked.reason?.userMessage ?? null,
            reason: blocked.reason,
        }
    }

    const requiresInfoRails = candidates.filter((rail) => rail.status === 'requires-info')

    // 4. accept-tos
    const tosRail = requiresInfoRails.find((rail) =>
        railActions(rail, actionByKey).some((action) => action.kind === 'accept-tos')
    )
    if (tosRail) {
        const tosAction = railActions(tosRail, actionByKey).find((a) => a.kind === 'accept-tos')
        return {
            kind: 'accept-tos',
            tosUrl: tosAction?.tosUrl,
            userMessage: tosRail.reason?.userMessage ?? null,
            reason: tosRail.reason,
        }
    }

    // 5. fixable-rejection (Sumsub RFI / self-heal)
    const fixableRail = requiresInfoRails.find((rail) =>
        railActions(rail, actionByKey).some((action) => action.kind === 'sumsub')
    )
    if (fixableRail) {
        return {
            kind: 'fixable-rejection',
            userMessage: fixableRail.reason?.userMessage ?? null,
            reason: fixableRail.reason,
        }
    }

    // 6. pending — BE is provisioning, no user action needed
    const hasPending = candidates.some((rail) => rail.status === 'pending')
    if (hasPending) return { kind: 'pending' }

    // 7. waiting-on-provider — every in-scope requires-info rail has ONLY
    // `wait` actions (no actionable alternative anywhere in scope). Placed
    // after ready/pending so a usable rail wins; placed before needs-identity/
    // enrollment so the user sees "we're checking" instead of a misleading
    // "verify your identity" CTA. Without this branch the rail would fall
    // through to needs-enrollment and bounce the user back into Sumsub for
    // nothing.
    const allWaiting =
        requiresInfoRails.length > 0 &&
        requiresInfoRails.every((rail) => {
            const actions = railActions(rail, actionByKey)
            return actions.length > 0 && actions.every((action) => action.kind === 'wait')
        })
    if (allWaiting) {
        // Pick the first wait-only rail's reason for the message (consumers
        // typically have one rail per scope anyway).
        const waitRail = requiresInfoRails[0]
        return {
            kind: 'waiting-on-provider',
            userMessage: waitRail.reason?.userMessage ?? null,
            reason: waitRail.reason,
        }
    }

    // 7b. Requires-info rails EXIST in scope but none surfaced an actionable step
    // (no accept-tos / sumsub / wait). The rail exists so the user is NOT missing a
    // region; it needs a document the backend resolver punts to the FE resubmit
    // endpoint (e.g. a Bridge government-id DOCUMENT_SELF_HEAL, requirementKey
    // government_id_document). Route to the self-heal / document flow
    // (fixable-rejection -> handleSelfHealResubmit) instead of the misleading
    // Unlock {region} cross-region modal, which sent these users into a fake
    // You're unlocked loop (tap Submit document, see success, bounce back with
    // nothing changed).
    if (requiresInfoRails.length > 0) {
        const rail = requiresInfoRails[0]
        return {
            kind: 'fixable-rejection',
            userMessage: rail.reason?.userMessage ?? null,
            reason: rail.reason,
        }
    }

    // 8/9. no functional rail in scope. Distinguish identity-not-cleared vs
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
