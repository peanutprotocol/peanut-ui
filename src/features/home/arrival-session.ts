'use client'

import { fetchEdgeCountry } from '@/features/setup/country-signals'
import { reportArrival } from '@/services/arrival'
import { isCapacitor } from '@/utils/capacitor'
import { normalizeCountrySignal } from '@/utils/country-signal'
import type { Arrival } from './arrival.types'

/** A resume after this long in the background counts as a new app session. */
export const ARRIVAL_RECHECK_AFTER_MS = 60 * 60 * 1000

// Module memory, not React state: the check runs once per user per app
// session, and its answer must survive a Home remount (React strict mode runs
// effects twice), because the backend answers a prompt only once.
let checkedFor: string | null = null
let arrival: Arrival | null = null
let generation = 0
let backgroundedAt: number | null = null
let resumeListener: Promise<unknown> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export const currentArrival = () => arrival
/** Bumped when a resume renews the session, so a mounted Home checks again. */
export const currentArrivalGeneration = () => generation

export function subscribeArrival(listener: () => void) {
    listeners.add(listener)
    listenForResume()
    return () => {
        listeners.delete(listener)
    }
}

/**
 * Asks the backend once per user per app session. The edge country comes
 * first (uncached); the ipapi answer is the fallback. No country, no call.
 */
export async function checkArrival(userId: string, ipCountry: string | null): Promise<void> {
    if (checkedFor === userId) return
    checkedFor = userId
    const country = (await fetchEdgeCountry()) ?? normalizeCountrySignal(ipCountry)
    if (!country) return
    const prompt = await reportArrival(country).catch(() => null)
    if (!prompt) return
    arrival = { userId, country, prompt }
    emit()
}

export function dismissArrival() {
    arrival = null
    emit()
}

// Registered once and kept for the app's lifetime, so a resume on any screen
// renews the session for the next Home visit, not only while Home is mounted.
function listenForResume() {
    if (resumeListener || !isCapacitor()) return
    resumeListener = import('@capacitor/app')
        .then(({ App }) =>
            App.addListener('appStateChange', ({ isActive }) => {
                if (!isActive) {
                    backgroundedAt = Date.now()
                    return
                }
                const since = backgroundedAt
                backgroundedAt = null
                if (since !== null && Date.now() - since >= ARRIVAL_RECHECK_AFTER_MS) {
                    checkedFor = null
                    generation += 1
                    emit()
                }
            })
        )
        .catch(() => {
            resumeListener = null
        })
}

export function resetArrivalSessionForTests() {
    checkedFor = null
    arrival = null
    generation = 0
    backgroundedAt = null
    resumeListener = null
    listeners.clear()
}
