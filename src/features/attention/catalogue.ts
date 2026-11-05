import snapshot from './catalogue.generated.json'
import type { AskId, AskPolicy, AttentionAsk, SlotId, Surface, Tier } from './types'

export interface CatalogueEntry {
    id: AskId
    tier: Tier
    rank: number
    surfaces: Surface[]
    slots?: SlotId[]
    policy: Omit<AskPolicy, 'slotWhen' | 'surfaceWhen'>
    analyticsKey: string
    emailMappings: { prefix: string; when?: 'activated' | 'not-activated' }[]
}

export interface AttentionSettings {
    settleMs: number
    quietSessionMinCount: number
    announcementCooldownDays: number
    maxConsecutiveSessions: number
    balanceThresholdUsd: number
    nextPaymentAfterDays: number
    defaultSnoozeDays: number
}

export const CATALOGUE_VERSION = 1
export const DEFAULT_CATALOGUE = snapshot.catalogue as CatalogueEntry[]
export const DEFAULT_SETTINGS: AttentionSettings = snapshot.settings

const SURFACES = new Set(['interrupt', 'zone', 'inline', 'banner'])
const BUDGETS = new Set(['always', 'session', 'quiet', 'never'])
const NUMERIC_POLICY_KEYS = ['snoozeDays', 'expiryDays', 'minSessions', 'maxConsecutiveSessions'] as const
const BOOLEAN_POLICY_KEYS = ['anchorsHome', 'overAnchor'] as const
const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
const nonnegative = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0

export function asCatalogue(value: unknown): CatalogueEntry[] | undefined {
    if (!Array.isArray(value) || value.length === 0 || value.length > 64) return undefined
    const ids = new Set<string>()
    const rows: CatalogueEntry[] = []
    for (const row of value) {
        if (
            !record(row) ||
            typeof row.id !== 'string' ||
            !/^[a-z0-9-]{1,40}$/.test(row.id) ||
            ids.has(row.id) ||
            !Number.isInteger(row.tier) ||
            !nonnegative(row.tier) ||
            row.tier < 1 ||
            row.tier > 6 ||
            !nonnegative(row.rank) ||
            !Array.isArray(row.surfaces) ||
            row.surfaces.length === 0 ||
            row.surfaces.length > 4 ||
            !row.surfaces.every((surface) => SURFACES.has(surface)) ||
            new Set(row.surfaces).size !== row.surfaces.length ||
            !record(row.policy) ||
            !BUDGETS.has(row.policy.interrupt as string) ||
            typeof row.analyticsKey !== 'string' ||
            row.analyticsKey.length > 100 ||
            !Array.isArray(row.emailMappings) ||
            row.emailMappings.length > 32
        )
            return undefined
        const sourcePolicy = row.policy
        if (
            row.slots !== undefined &&
            (!Array.isArray(row.slots) || row.slots.some((slot) => slot !== 'bank-transfer' && slot !== 'limits'))
        )
            return undefined
        if (row.policy.routes !== undefined && row.policy.routes !== 'home' && row.policy.routes !== 'any')
            return undefined
        if (NUMERIC_POLICY_KEYS.some((key) => sourcePolicy[key] !== undefined && !nonnegative(sourcePolicy[key])))
            return undefined
        if (
            BOOLEAN_POLICY_KEYS.some((key) => sourcePolicy[key] !== undefined && typeof sourcePolicy[key] !== 'boolean')
        )
            return undefined
        if (
            row.emailMappings.some(
                (mapping) =>
                    !record(mapping) ||
                    typeof mapping.prefix !== 'string' ||
                    mapping.prefix.length > 100 ||
                    (mapping.when !== undefined && mapping.when !== 'activated' && mapping.when !== 'not-activated')
            )
        )
            return undefined
        ids.add(row.id)
        const policy: CatalogueEntry['policy'] = {
            interrupt: row.policy.interrupt as CatalogueEntry['policy']['interrupt'],
            ...(row.policy.routes !== undefined ? { routes: row.policy.routes } : {}),
        }
        for (const key of NUMERIC_POLICY_KEYS)
            if (row.policy[key] !== undefined) policy[key] = row.policy[key] as number
        for (const key of BOOLEAN_POLICY_KEYS)
            if (row.policy[key] !== undefined) policy[key] = row.policy[key] as boolean
        rows.push({
            id: row.id as AskId,
            tier: row.tier as Tier,
            rank: row.rank,
            surfaces: [...row.surfaces] as Surface[],
            policy,
            analyticsKey: row.analyticsKey,
            emailMappings: row.emailMappings.map((mapping) => ({
                prefix: mapping.prefix as string,
                ...(mapping.when ? { when: mapping.when as 'activated' | 'not-activated' } : {}),
            })),
            ...(row.slots ? { slots: [...row.slots] as SlotId[] } : {}),
        })
    }
    // A supported catalogue is an atomic replacement, never a mix of live and bundled rules.
    if (DEFAULT_CATALOGUE.some((row) => !ids.has(row.id))) return undefined
    return rows
}

export function asSettings(value: unknown): AttentionSettings | undefined {
    if (!record(value)) return undefined
    const keys = Object.keys(DEFAULT_SETTINGS) as (keyof AttentionSettings)[]
    if (keys.some((key) => !nonnegative(value[key]))) return undefined
    if (!Number.isInteger(value.quietSessionMinCount) || !Number.isInteger(value.maxConsecutiveSessions))
        return undefined
    return Object.fromEntries(keys.map((key) => [key, value[key]])) as unknown as AttentionSettings
}

interface CatalogueSource {
    catalogueVersion?: number
    catalogue?: CatalogueEntry[]
    settings?: AttentionSettings
}

export function getCatalogue(source?: CatalogueSource): readonly CatalogueEntry[] {
    return source?.catalogueVersion === CATALOGUE_VERSION && source.catalogue ? source.catalogue : DEFAULT_CATALOGUE
}

export function getSettings(source?: CatalogueSource): AttentionSettings {
    return source?.catalogueVersion === CATALOGUE_VERSION && source.settings ? source.settings : DEFAULT_SETTINGS
}

export function applyCatalogue(ask: AttentionAsk, row: CatalogueEntry): AttentionAsk {
    return {
        ...ask,
        tier: row.tier,
        rank: row.rank,
        surfaces: row.surfaces,
        slots: row.slots,
        analyticsKey: row.analyticsKey,
        policy: {
            ...row.policy,
            ...(ask.policy.slotWhen ? { slotWhen: ask.policy.slotWhen } : {}),
            ...(ask.policy.surfaceWhen ? { surfaceWhen: ask.policy.surfaceWhen } : {}),
        },
    }
}

export function defineAsk(
    id: AskId,
    local: Omit<AttentionAsk, 'id' | 'tier' | 'rank' | 'surfaces' | 'slots' | 'analyticsKey' | 'policy'> & {
        policy?: Pick<AskPolicy, 'slotWhen' | 'surfaceWhen'>
    }
): AttentionAsk {
    const row = DEFAULT_CATALOGUE.find((entry) => entry.id === id)
    if (!row) throw new Error(`Missing generated attention rule: ${id}`)
    return applyCatalogue({ ...local, ...row, policy: { ...row.policy, ...local.policy } }, row)
}
