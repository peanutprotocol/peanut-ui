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
 */
export const EEA_UPLIFT_REQUIREMENT_KEYS = new Set<string>([
    'sof_individual_primary_purpose',
    'has_foreign_tax_registration',
    'place_of_birth_missing',
    'nationalities',
])

/**
 * Blocking path: the gate's reason code IS the `eea_uplift*` cluster. Returns
 * the code when it's an uplift remediation (truthy → track it), else undefined.
 */
export function eeaUpliftReasonCode(gate: GateState): string | undefined {
    const code = (gate as { reason?: { code?: string } }).reason?.code
    return code?.startsWith('eea_uplift') ? code : undefined
}

/** Advisory path: the future-dated requirement key belongs to the uplift set. */
export function isEeaUpliftAdvisory(advisory: GateAdvisory | undefined): boolean {
    return !!advisory?.requirementKey && EEA_UPLIFT_REQUIREMENT_KEYS.has(advisory.requirementKey)
}
