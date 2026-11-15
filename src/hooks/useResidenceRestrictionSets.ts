import { apiFetch } from '@/utils/api-fetch'
import {
    getResidenceRestrictionSets,
    parseResidenceRestrictionSets,
    setServerResidenceRestrictionSets,
    type ResidenceRestrictionSets,
} from '@/utils/residence-restriction-sets'
import { isDemoMode } from '@/utils/demo'
import { useEffect, useState } from 'react'

export { getResidenceRestrictionSets, type ResidenceRestrictionSets } from '@/utils/residence-restriction-sets'

let inflight: Promise<ResidenceRestrictionSets | null> | null = null
let freshAnswer = false

async function loadServerSets(): Promise<ResidenceRestrictionSets | null> {
    if (freshAnswer) return getResidenceRestrictionSets()
    // public config: no auth, so it must not queue behind token hydration
    inflight ??= apiFetch('/config/residence-restrictions', { includeAuth: false })
        .then(async (res) => {
            if (!res.ok) return null
            const parsed = parseResidenceRestrictionSets(await res.json())
            // Demo mode answers from its synthetic backend, which must not outlive the demo session.
            if (parsed && !isDemoMode()) {
                setServerResidenceRestrictionSets(parsed)
                freshAnswer = true
            }
            return parsed
        })
        .catch(() => null)
        .finally(() => {
            inflight = null
        })
    return inflight
}

/** Test-only: clears session state. */
export const __resetResidenceRestrictionSetsForTests = () => {
    setServerResidenceRestrictionSets(null)
    inflight = null
    freshAnswer = false
}

type ResidenceRestrictionStatus = { sets: ResidenceRestrictionSets; settled: true } | { sets: null; settled: false }

/**
 * The served restriction lists, or `null` while they are unknown. They are known
 * only from a live answer to `GET /config/residence-restrictions` in this
 * session (fetched once, shared by every mount). Nothing is kept on the device:
 * a cached policy can be stale the moment the API changes, so until an answer
 * arrives (or if every request fails) the lists stay unknown and callers offer
 * nothing that depends on them.
 */
export const useResidenceRestrictionSetsWithStatus = (): ResidenceRestrictionStatus => {
    const [sets, setSets] = useState<ResidenceRestrictionSets | null>(getResidenceRestrictionSets)

    useEffect(() => {
        setSets(getResidenceRestrictionSets())
        let cancelled = false
        void loadServerSets().then((loaded) => {
            if (cancelled || !loaded) return
            setSets(loaded)
        })
        return () => {
            cancelled = true
        }
    }, [])

    return sets ? { sets, settled: true } : { sets: null, settled: false }
}

export const useResidenceRestrictionSets = (): ResidenceRestrictionSets | null =>
    useResidenceRestrictionSetsWithStatus().sets
