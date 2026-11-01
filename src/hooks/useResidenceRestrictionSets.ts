import { apiFetch } from '@/utils/api-fetch'
import {
    LOCAL_RESIDENCE_RESTRICTION_SETS,
    parseResidenceRestrictionSets,
    serverResidenceRestrictionSets,
    setServerResidenceRestrictionSets,
    type ResidenceRestrictionSets,
} from '@/utils/residence-restriction-sets'
import { useEffect, useState } from 'react'

export {
    getResidenceRestrictionSets,
    LOCAL_RESIDENCE_RESTRICTION_SETS,
    type ResidenceRestrictionSets,
} from '@/utils/residence-restriction-sets'

let inflight: Promise<ResidenceRestrictionSets | null> | null = null

async function loadServerSets(): Promise<ResidenceRestrictionSets | null> {
    const cached = serverResidenceRestrictionSets()
    if (cached) return cached
    // public config: no auth, so it must not queue behind token hydration
    inflight ??= apiFetch('/config/residence-restrictions', { includeAuth: false })
        .then(async (res) => {
            if (!res.ok) return null
            const parsed = parseResidenceRestrictionSets(await res.json())
            if (parsed) setServerResidenceRestrictionSets(parsed)
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
    setServerResidenceRestrictionSets(null)
    inflight = null
}

/**
 * The residence-restriction tiers, server-authoritative with a bundled
 * fallback: renders immediately from the local mirror and swaps to
 * GET /config/residence-restrictions once it arrives, so compliance can tune
 * the lists with an API deploy and the signup step follows without an app
 * release. `settled` flips only when a server list was actually parsed:
 * a failed or malformed lookup leaves it false, so callers that must not
 * make definitive claims from the mirror alone keep treating the data as
 * non-authoritative.
 */
export const useResidenceRestrictionSetsWithStatus = (): { sets: ResidenceRestrictionSets; settled: boolean } => {
    const [sets, setSets] = useState<ResidenceRestrictionSets>(
        serverResidenceRestrictionSets() ?? LOCAL_RESIDENCE_RESTRICTION_SETS
    )
    const [settled, setSettled] = useState<boolean>(serverResidenceRestrictionSets() !== null)

    useEffect(() => {
        if (serverResidenceRestrictionSets()) return
        let cancelled = false
        void loadServerSets().then((loaded) => {
            if (cancelled || !loaded) return
            setSets(loaded)
            setSettled(true)
        })
        return () => {
            cancelled = true
        }
    }, [])

    return { sets, settled }
}

export const useResidenceRestrictionSets = (): ResidenceRestrictionSets => useResidenceRestrictionSetsWithStatus().sets
