import { type RailCapability } from '@/types/capabilities'

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
export type ProviderRejectionState = 'happy' | 'fixable' | 'blocked'

export interface ProviderRejectionInfo {
    provider: 'BRIDGE' | 'MANTECA'
    state: ProviderRejectionState
    userMessage: string | null
}

const PROVIDER_CODE: Record<'BRIDGE' | 'MANTECA', 'bridge' | 'manteca'> = {
    BRIDGE: 'bridge',
    MANTECA: 'manteca',
}

/** Derive the rejection state for a single provider from the capability rails. */
export function deriveProviderRejection(
    rails: RailCapability[],
    provider: 'BRIDGE' | 'MANTECA'
): ProviderRejectionInfo {
    const providerRails = rails.filter((rail) => rail.provider === PROVIDER_CODE[provider])
    const fixableRail = providerRails.find((rail) => rail.status === 'requires-info')
    const blockedRail = providerRails.find((rail) => rail.status === 'blocked')
    const state: ProviderRejectionState = fixableRail ? 'fixable' : blockedRail ? 'blocked' : 'happy'
    return {
        provider,
        state,
        userMessage: (fixableRail ?? blockedRail)?.reason?.userMessage ?? null,
    }
}
