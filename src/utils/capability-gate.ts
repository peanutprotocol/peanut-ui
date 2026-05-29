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
 *   (new)             → pending           (BE working — surface explicitly)
 */
export type GateState =
    | { kind: 'loading' }
    | { kind: 'ready' }
    | { kind: 'pending' }
    | { kind: 'accept-tos'; tosUrl?: string; userMessage: string | null }
    | { kind: 'fixable-rejection'; userMessage: string | null; reason?: CapabilityReason }
    | { kind: 'blocked-rejection'; userMessage: string | null; reason?: CapabilityReason }
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
 *   1. loading           — capability state not yet settled
 *   2. blocked-rejection — any in-scope rail status: 'blocked'
 *   3. accept-tos        — requires-info + a `bridge-tos` action (carries tosUrl)
 *   4. fixable-rejection — requires-info + a `sumsub` action
 *   5. ready             — at least one in-scope rail has operationStatus(op) === 'enabled'
 *   6. pending           — at least one in-scope rail status === 'pending' (provisioning)
 *   7. needs-identity    — no functional rail in scope AND identity not verified
 *   8. needs-enrollment  — no functional rail in scope BUT identity verified
 */
export function deriveGate(state: CapabilityState, op: RailOperation, scope: GateScope = {}): GateState {
    if (state.isLoading) return { kind: 'loading' }

    const candidates = filterRailsByScope(state.rails, scope)
    const actionByKey = new Map(state.nextActions.map((action) => [action.key, action]))

    // 2. blocked
    const blocked = candidates.find((rail) => rail.status === 'blocked')
    if (blocked) {
        return {
            kind: 'blocked-rejection',
            userMessage: blocked.reason?.userMessage ?? null,
            reason: blocked.reason,
        }
    }

    const requiresInfoRails = candidates.filter((rail) => rail.status === 'requires-info')

    // 3. accept-tos
    const tosRail = requiresInfoRails.find((rail) =>
        railActions(rail, actionByKey).some((action) => action.kind === 'accept-tos')
    )
    if (tosRail) {
        const tosAction = railActions(tosRail, actionByKey).find((a) => a.kind === 'accept-tos')
        return {
            kind: 'accept-tos',
            tosUrl: tosAction?.tosUrl,
            userMessage: tosRail.reason?.userMessage ?? null,
        }
    }

    // 4. fixable-rejection (Sumsub RFI / self-heal)
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

    // 5. ready — per-op refinement wins over rail-level status
    const hasReady = candidates.some((rail) => operationStatus(rail, op) === 'enabled')
    if (hasReady) return { kind: 'ready' }

    // 6. pending — BE is provisioning, no user action needed
    const hasPending = candidates.some((rail) => rail.status === 'pending')
    if (hasPending) return { kind: 'pending' }

    // 7/8. no functional rail in scope. Distinguish identity-not-cleared vs
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
): 'blocked' | 'provider_rejection' | 'cross_region' | 'default' {
    if (kind === 'blocked-rejection') return 'blocked'
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
    if (gate.kind === 'fixable-rejection' || gate.kind === 'blocked-rejection' || gate.kind === 'accept-tos') {
        return gate.userMessage ?? undefined
    }
    return undefined
}
