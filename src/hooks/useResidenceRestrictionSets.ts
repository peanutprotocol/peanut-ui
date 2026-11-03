import { apiFetch } from '@/utils/api-fetch'
import {
    getResidenceRestrictionSets,
    parseResidenceRestrictionSets,
    setServerResidenceRestrictionSets,
    type ResidenceRestrictionSets,
} from '@/utils/residence-restriction-sets'
import { readStoredValue, writeStoredValue, removeStoredValue } from '@/utils/safe-storage'
import { isDemoMode } from '@/utils/demo'
import { useEffect, useState } from 'react'

export { getResidenceRestrictionSets, type ResidenceRestrictionSets } from '@/utils/residence-restriction-sets'

const STORAGE_KEY = 'peanut:residenceRestrictions'
let inflight: Promise<ResidenceRestrictionSets | null> | null = null
let cacheRestored = false
let freshAnswer = false

function restoreDeviceCache() {
    if (cacheRestored) return
    cacheRestored = true
    const stored = readStoredValue(STORAGE_KEY)
    if (stored === null) return
    try {
        const parsed = parseResidenceRestrictionSets(JSON.parse(stored))
        if (parsed) {
            setServerResidenceRestrictionSets(parsed)
            return
        }
    } catch {}
    removeStoredValue(STORAGE_KEY)
}

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
                writeStoredValue(
                    STORAGE_KEY,
                    JSON.stringify(
                        Object.fromEntries(Object.entries(parsed).map(([key, values]) => [key, [...values]]))
                    )
                )
            }
            return parsed
        })
        .catch(() => null)
        .finally(() => {
            inflight = null
        })
    return inflight
}

/** Test-only: clears session state; tests own device storage cleanup. */
export const __resetResidenceRestrictionSetsForTests = () => {
    setServerResidenceRestrictionSets(null)
    inflight = null
    cacheRestored = false
    freshAnswer = false
}

type ResidenceRestrictionStatus = { sets: ResidenceRestrictionSets; settled: true } | { sets: null; settled: false }

/**
 * The served restriction lists, or `null` while they are unknown. The last
 * answer this device parsed is restored after mount (never at render, so the
 * static export hydrates) and counts as settled; a fresh fetch replaces it once
 * per session. With neither, the lists stay unknown and callers offer nothing
 * that depends on them.
 */
export const useResidenceRestrictionSetsWithStatus = (): ResidenceRestrictionStatus => {
    const [sets, setSets] = useState<ResidenceRestrictionSets | null>(getResidenceRestrictionSets)

    useEffect(() => {
        if (!freshAnswer) restoreDeviceCache()
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
