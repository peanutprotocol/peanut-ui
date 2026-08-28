import {
    BANKING_RESTRICTED_RESIDENCE_ISO2,
    CARD_RESTRICTED_RESIDENCE_ISO2,
    RESTRICTED_RESIDENCE_ISO2,
} from '@/constants/residence.consts'
import { apiFetch } from '@/utils/api-fetch'
import { useEffect, useState } from 'react'

export interface ResidenceRestrictionSets {
    full: ReadonlySet<string>
    cardOnly: ReadonlySet<string>
    bankingOnly: ReadonlySet<string>
}

/** Bundled mirror — the offline/pre-fetch fallback, never the source of truth. */
export const LOCAL_RESIDENCE_RESTRICTION_SETS: ResidenceRestrictionSets = {
    full: RESTRICTED_RESIDENCE_ISO2,
    cardOnly: CARD_RESTRICTED_RESIDENCE_ISO2,
    bankingOnly: BANKING_RESTRICTED_RESIDENCE_ISO2,
}

// Module-level cache: the lists change with API deploys, not with users, so one
// fetch per session is plenty and every hook instance shares it.
let serverSets: ResidenceRestrictionSets | null = null
let inflight: Promise<ResidenceRestrictionSets | null> | null = null

const parseLists = (json: unknown): ResidenceRestrictionSets | null => {
    if (!json || typeof json !== 'object') return null
    const { full, cardOnly, bankingOnly } = json as Record<string, unknown>
    const toSet = (value: unknown): ReadonlySet<string> | null =>
        Array.isArray(value) && value.every((v) => typeof v === 'string')
            ? new Set(value.map((v) => v.toUpperCase()))
            : null
    const fullSet = toSet(full)
    const cardSet = toSet(cardOnly)
    const bankingSet = toSet(bankingOnly)
    if (!fullSet || !cardSet || !bankingSet) return null
    return { full: fullSet, cardOnly: cardSet, bankingOnly: bankingSet }
}

async function loadServerSets(): Promise<ResidenceRestrictionSets | null> {
    if (serverSets) return serverSets
    // public config: no auth, so it must not queue behind token hydration
    inflight ??= apiFetch('/config/residence-restrictions', { includeAuth: false })
        .then(async (res) => {
            if (!res.ok) return null
            const parsed = parseLists(await res.json())
            if (parsed) serverSets = parsed
            return parsed
        })
        .catch(() => null)
        .finally(() => {
            inflight = null
        })
    return inflight
}

/** Test-only: clears the module cache so suites can exercise the fetch again. */
export const __resetResidenceRestrictionSetsForTests = () => {
    serverSets = null
    inflight = null
}

/**
 * The residence-restriction tiers, server-authoritative with a bundled
 * fallback: renders immediately from the local mirror and swaps to
 * GET /config/residence-restrictions once it arrives, so compliance can tune
 * the lists with an API deploy and the signup step follows without an app
 * release.
 */
export const useResidenceRestrictionSets = (): ResidenceRestrictionSets => {
    const [sets, setSets] = useState<ResidenceRestrictionSets>(serverSets ?? LOCAL_RESIDENCE_RESTRICTION_SETS)

    useEffect(() => {
        if (serverSets) return
        let cancelled = false
        void loadServerSets().then((loaded) => {
            if (loaded && !cancelled) setSets(loaded)
        })
        return () => {
            cancelled = true
        }
    }, [])

    return sets
}
