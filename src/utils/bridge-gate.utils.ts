import { type NextAction, type ProviderCode, type RailCapability } from '@/types/capabilities'

/**
 * Pre-transfer gate action for Bridge bank flows. Identical shape to the legacy
 * `useBridgeTransferReadiness` hook so existing consumers (add-money/bank,
 * withdraw/bank, claim BankFlowManager) keep the same `gate.type` branching and
 * the same InitiateKycModal wiring via {@link getKycModalVariant} /
 * {@link getGateProviderMessage} below.
 */
export type BridgeGateAction =
    | { type: 'accept_tos' }
    | { type: 'fixable_rejection'; userMessage: string | null }
    | { type: 'blocked_rejection'; userMessage: string | null }
    | { type: 'needs_kyc' }
    | { type: 'needs_enrollment' }
    | { type: 'ready' }
    // capabilities not yet loaded — caller should hold (spinner) instead of
    // showing a needs_kyc modal on top of the user's REAL (unknown) state.
    | { type: 'loading' }

const BRIDGE: ProviderCode = 'bridge'

/**
 * Derive the Bridge transfer gate from the backend capability model.
 *
 * MIGRATION-REVIEW: replaces `useBridgeTransferReadiness` (which read
 * useBridgeTosStatus + useProviderRejectionStatus + useKycStatus over raw
 * `user.rails` / `kycVerifications`). The backend resolver now expresses every
 * one of those derived signals directly as the rail's capability status +
 * nextActions, so this is a pure, provider-scoped read — NO provider-state
 * interpretation. It is intentionally a plain function (not a hook): the
 * consumer calls `useCapabilities()` and passes `rails` + `nextActions` in, so
 * the same memo deps the consumer already has drive it.
 *
 * Faithfulness to the old hook's exact priority order (verified against
 * `useBridgeTransferReadiness.test.ts`):
 *   1. blocked_rejection  — old `bridgeRejection.state === 'blocked'`
 *        ← any Bridge rail `status === 'blocked'`. Highest priority (ToS moot).
 *   2. accept_tos         — old `needsBridgeTos`
 *        ← any Bridge rail `requires-info` whose blockingActions include a
 *          `bridge-tos` action. (Old hook: REQUIRES_INFORMATION, or a
 *          non-ENABLED rail with `tos_acceptance`/`tos_v2_acceptance` in
 *          additionalRequirements — both now surface as the `bridge-tos`
 *          NextAction the resolver attaches to a requires-info rail.)
 *   3. fixable_rejection  — old `bridgeRejection.state === 'fixable'`
 *        ← any Bridge rail `requires-info` whose blockingActions include a
 *          `sumsub` action (a document RFI / self-heal). userMessage ←
 *          rail.reason.userMessage (was the parsed rejection reason).
 *   4. needs_kyc          — old `!isUserSumsubKycApproved && !hasEnabledRail`
 *        ← NO Bridge rail enabled AND identity not yet verified anywhere
 *          (`!isKycApproved` — see CONTRACT GAP note).
 *   5. needs_enrollment   — old `isUserSumsubKycApproved && !hasFunctionalRail`
 *        ← identity verified (`isKycApproved`) but NO functional Bridge rail
 *          (none enabled / pending / requires-info).
 *   6. ready              — everything else: an enabled Bridge rail, OR a
 *          functional (pending / requires-info-without-an-actionable-block)
 *          Bridge rail.
 *
 * CONTRACT GAP (flagged): Sumsub identity has no rail in the capability model,
 * so the old `isUserSumsubKycApproved` precondition has no direct field. The
 * established proxy from the already-migrated consumers (qr-pay, ActivationCTAs,
 * MantecaFlowManager — commits f4eb9f70e / 8c98a3e81) is `isKycApproved` (any
 * enabled rail ⇒ identity cleared at least once). This is faithful for every
 * case the old hook actually hit, because once identity is approved the backend
 * advances the Bridge rail itself (pending → requires-info → enabled) — i.e. a
 * functional Bridge rail already implies identity, and the only `isKycApproved`-
 * gated divergence is "identity approved via another provider, Bridge not yet
 * started" → needs_enrollment, which matches the old `needs_enrollment`.
 */
export function deriveBridgeGate(
    rails: RailCapability[],
    nextActions: NextAction[],
    isKycApproved: boolean,
    isLoading: boolean = false
): BridgeGateAction {
    // Until the user query settles, the empty capability shape is indistinguishable
    // from "no Bridge state". Hold the gate in 'loading' so callers don't render a
    // needs_kyc modal on top of an approved user whose data simply hasn't arrived.
    if (isLoading) return { type: 'loading' }
    const bridgeRails = rails.filter((rail) => rail.provider === BRIDGE)

    const actionByKey = new Map(nextActions.map((action) => [action.key, action]))
    const railActions = (rail: RailCapability): NextAction[] =>
        (rail.blockingActions ?? [])
            .map((key) => actionByKey.get(key))
            .filter((action): action is NextAction => action !== undefined)

    // 1. hard rejection — contact support (checked first; ToS is moot for blocked users)
    const blockedRail = bridgeRails.find((rail) => rail.status === 'blocked')
    if (blockedRail) {
        return { type: 'blocked_rejection', userMessage: blockedRail.reason?.userMessage ?? null }
    }

    const requiresInfoRails = bridgeRails.filter((rail) => rail.status === 'requires-info')

    // 2. tos acceptance — a requires-info Bridge rail whose unlock is a bridge-tos action
    const tosRail = requiresInfoRails.find((rail) => railActions(rail).some((action) => action.kind === 'bridge-tos'))
    if (tosRail) return { type: 'accept_tos' }

    // 3. fixable rejection — a requires-info Bridge rail whose unlock is a sumsub RFI (self-heal)
    const fixableRail = requiresInfoRails.find((rail) => railActions(rail).some((action) => action.kind === 'sumsub'))
    if (fixableRail) {
        return { type: 'fixable_rejection', userMessage: fixableRail.reason?.userMessage ?? null }
    }

    const hasEnabledBridgeRail = bridgeRails.some((rail) => rail.status === 'enabled')

    // 4. fresh user needs standard kyc before a transfer. An enabled Bridge rail
    // still passes (legacy / out-of-band approval), matching the old hook.
    if (!isKycApproved && !hasEnabledBridgeRail) {
        return { type: 'needs_kyc' }
    }

    // 5. needs enrollment — identity verified, but no functional Bridge rail
    // (none enabled / pending / requires-info: the user has not started Bridge).
    const hasFunctionalBridgeRail = bridgeRails.some(
        (rail) => rail.status === 'enabled' || rail.status === 'pending' || rail.status === 'requires-info'
    )
    if (isKycApproved && !hasFunctionalBridgeRail) {
        return { type: 'needs_enrollment' }
    }

    // 6. ready
    return { type: 'ready' }
}

/** maps gate type to InitiateKycModal variant */
export function getKycModalVariant(gateType: BridgeGateAction['type']) {
    if (gateType === 'blocked_rejection') return 'blocked' as const
    if (gateType === 'fixable_rejection') return 'provider_rejection' as const
    if (gateType === 'needs_enrollment') return 'cross_region' as const
    return 'default' as const
}

/** extracts provider message from gate for InitiateKycModal */
export function getGateProviderMessage(gate: BridgeGateAction): string | undefined {
    if (gate.type === 'fixable_rejection' || gate.type === 'blocked_rejection') {
        return gate.userMessage ?? undefined
    }
    return undefined
}
