import { type NextAction, type RailCapability } from '@/types/capabilities'
import { railUserMessage, railVerdict } from '@/utils/capability-gate'

/**
 * Per-provider rejection state for the KYC status surfaces, derived from the
 * backend capability model.
 *
 * MIGRATION-REVIEW: replaces the legacy `useProviderRejectionStatus` hook, which
 * derived fixable/blocked/processing/happy from raw `user.rails` status +
 * self-heal metadata + reject-type + attempt caps + `kycVerifications`. That
 * eligibility decision now lives entirely in the backend resolver and is
 * expressed as the rail's top-level capability status:
 *   - fixable (user can submit more docs) → rail status `'requires-info'`
 *   - blocked  (contact support / final)  → rail status `'blocked'`
 *   - happy    (enabled / nothing pending an action) → everything else
 * `userMessage` ← the prioritized rail's `reason.userMessage` (fixable first,
 * then blocked), matching the old hook's priority order.
 *
 * This is the same inline mapping the already-migrated consumers use
 * (ActivationCTAs — 8c98a3e81; MantecaFlowManager), extracted here so the
 * remaining `useProviderRejectionStatus` consumers share one derivation.
 *
 * CONTRACT GAP (flagged): the old type also exposed `rejectedRails`,
 * `kycVerification`, `selfHealAttempt`, and `maxAttempts` (the self-heal attempt
 * counter shown in KycProviderRejection). The capability model carries no
 * per-attempt counter, so those fields are dropped — see KycProviderRejection
 * for the dropped "Attempt N of M" line. The legacy 'processing' state is folded
 * into 'happy' because no consumer branches on it (all only check
 * `state === 'fixable'` / `'blocked'`).
 */
/**
 * Per-provider rejection state.
 *   - happy           : nothing pending an action
 *   - fixable         : user can re-submit docs via self-heal (`requires-info`)
 *   - restart-identity: blocked + the rail carries a `restart-identity` action
 *                       (today: Manteca country-not-supported). Self-fixable
 *                       by re-verifying with a different document.
 *   - blocked         : terminal — contact support
 */
export type ProviderRejectionState = 'happy' | 'fixable' | 'restart-identity' | 'blocked'

export interface ProviderRejectionInfo {
    provider: 'BRIDGE' | 'MANTECA'
    state: ProviderRejectionState
    userMessage: string | null
}

const PROVIDER_CODE: Record<'BRIDGE' | 'MANTECA', 'bridge' | 'manteca'> = {
    BRIDGE: 'bridge',
    MANTECA: 'manteca',
}

/**
 * Derive the rejection state for a single provider from the per-rail VERDICT
 * ({@link railVerdict}: `rail.resolved` BE-derived, shared legacy fallback).
 *
 * Mapping notes:
 *   - a `provide-email` verdict maps to `blocked` here — these surfaces would
 *     otherwise open a document-upload flow for a user whose only fix is
 *     adding an email (matches the legacy blocked-status shape).
 *   - `restart-identity` comes from the verdict's selfHealKind, with the
 *     legacy `country_not_supported` reason-code check kept for older
 *     responses (the code rides on `blocking.code` verbatim).
 *   - wait-marked rails resolve `pending` → `happy`: nothing user-actionable,
 *     so no fixable CTA (the legacy status check surfaced one that dead-ended).
 *
 * `nextActions` powers the legacy fallback's action-kind refinement; callers
 * without it get pure status semantics (what this util always had).
 */
export function deriveProviderRejection(
    rails: RailCapability[],
    provider: 'BRIDGE' | 'MANTECA',
    nextActions: NextAction[] = []
): ProviderRejectionInfo {
    const byKey = new Map(nextActions.map((action) => [action.key, action]))
    const candidates = rails
        .filter((rail) => rail.provider === PROVIDER_CODE[provider])
        .map((rail) => ({ rail, verdict: railVerdict(rail, byKey) }))

    const isProvideEmail = ({ verdict }: (typeof candidates)[number]) =>
        verdict.blocking?.selfHealKind === 'provide-email'
    const fixable = candidates.find((candidate) => candidate.verdict.status === 'fixable' && !isProvideEmail(candidate))
    const blocked = candidates.find((candidate) => candidate.verdict.status === 'blocked' || isProvideEmail(candidate))
    const isRestartIdentity =
        provider === 'MANTECA' &&
        (blocked?.verdict.blocking?.selfHealKind === 'restart-identity' ||
            blocked?.verdict.blocking?.code === 'country_not_supported')
    const state: ProviderRejectionState = fixable
        ? 'fixable'
        : isRestartIdentity
          ? 'restart-identity'
          : blocked
            ? 'blocked'
            : 'happy'
    const surfaced = fixable ?? blocked
    return {
        provider,
        state,
        userMessage: surfaced ? railUserMessage(surfaced.rail) || surfaced.verdict.blocking?.userMessage || null : null,
    }
}
