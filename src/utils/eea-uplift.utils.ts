import type { GateAdvisory, GateState } from '@/utils/capability-gate'

/**
 * Bridge remediation identified as an EEA-uplift questionnaire, split by how it
 * reaches the FE:
 *
 * - BLOCKING (post-cliff, effective date passed → gate `fixable-rejection`): the
 *   BE sets `reason.code` to the questionnaire cluster — `eea_uplift` /
 *   `eea_uplift_with_tin` (peanut-api-ts resolver). So a code prefix match is
 *   the clean signal.
 * - ADVISORY (future-dated → gate `ready` + advisory): the BE injects only
 *   `effectiveDate` + `requirementKey` onto the NextAction, NOT the cluster, so
 *   here we match the raw requirement keys whose cluster is `eea_uplift`.
 *
 * Key set derived from prod remediation data (2026-07). PoA / gov-id-expired
 * co-occur on the same cliff but are separate remediation (cluster `null`), so
 * they're deliberately excluded — keying PoA→eea would over-fire on ordinary
 * document rejections for non-EEA users.
 *
 * KNOWN LIMITATION: both signals mirror BE-owned strings (the resolver's cluster
 * codes and requirement keys). If the BE adds/renames an uplift key or reason
 * code, that segment silently drops out of the funnel until this file follows —
 * accepted tradeoff for keeping this FE-only.
 */
export const EEA_UPLIFT_REQUIREMENT_KEYS = new Set<string>([
    'sof_individual_primary_purpose',
    'has_foreign_tax_registration',
    'place_of_birth_missing',
    'nationalities',
])

/**
 * The uplift attempt being started. `source` distinguishes the two remediation
 * paths and — since blocking = the effective date has already passed — doubles
 * as the urgency signal: `blocking` = urgent post-cliff, `advisory` = upcoming.
 */
export type UpliftStartTrigger = {
    requirementKey?: string
    actionKey?: string
    effectiveDate?: string
    source: 'advisory' | 'blocking'
}

/**
 * Blocking path: the gate's reason code IS the `eea_uplift*` cluster. Returns a
 * ready-to-fire trigger when it's an uplift remediation, else null.
 */
export function upliftTriggerFromGate(gate: GateState): UpliftStartTrigger | null {
    // narrow on the union ('reason' is native to the gate variants that carry
    // it) rather than casting, so a rename of reason.code fails the build.
    const code = 'reason' in gate ? gate.reason?.code : undefined
    if (!code?.startsWith('eea_uplift')) return null
    return { requirementKey: code, source: 'blocking' }
}

/**
 * Advisory path: the future-dated requirement key belongs to the uplift set.
 * Returns a ready-to-fire trigger, else null.
 */
export function upliftTriggerFromAdvisory(advisory: GateAdvisory | undefined): UpliftStartTrigger | null {
    if (!advisory?.requirementKey || !EEA_UPLIFT_REQUIREMENT_KEYS.has(advisory.requirementKey)) return null
    return {
        requirementKey: advisory.requirementKey,
        actionKey: advisory.actionKey,
        effectiveDate: advisory.effectiveDate,
        source: 'advisory',
    }
}
