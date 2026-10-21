import { apiFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'
import { DEFAULT_KILL_SWITCHES, KILL_SWITCHES_PATH, KILL_SWITCHES_STORAGE_KEY } from './kill-switches.consts'
import type { KillSwitches } from './kill-switches.types'
import { resolveKillSwitches, sanitizeKillSwitches } from './kill-switches.utils'

/*
 * Kill switches come from our API. Until the first answer arrives (or when the
 * API cannot be reached) the app uses what the last good answer saved on this
 * device, and the built-in defaults for the rest.
 *
 * Saved in localStorage on web and native: the read is synchronous, so saved
 * values apply before the first render. Losing it (e.g. iOS storage eviction)
 * only means the defaults apply until the next fetch.
 */

function readSaved(): unknown {
    try {
        const raw = localStorage.getItem(KILL_SWITCHES_STORAGE_KEY)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

let current: KillSwitches =
    typeof window === 'undefined' ? DEFAULT_KILL_SWITCHES : resolveKillSwitches(null, readSaved())
const listeners = new Set<() => void>()

/** Current values, for code outside React. Components use `useKillSwitches`. */
export const getKillSwitches = (): KillSwitches => current

export function subscribeKillSwitches(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

async function fetchKillSwitches(): Promise<void> {
    let server: unknown
    try {
        // a failure here is expected and handled (saved values stay), so it leaves only a breadcrumb
        const response = await apiFetch(KILL_SWITCHES_PATH, { includeAuth: false, callerReportsFailures: true })
        if (!response.ok) return
        server = await response.json()
    } catch {
        return
    }
    // a good answer replaces the saved values: a key it leaves out is unset and falls back to its default
    const sanitized = sanitizeKillSwitches(server)
    try {
        localStorage.setItem(KILL_SWITCHES_STORAGE_KEY, JSON.stringify(sanitized))
    } catch {}
    const next = resolveKillSwitches(sanitized, null)
    if (JSON.stringify(next) === JSON.stringify(current)) return
    current = next
    listeners.forEach((listener) => listener())
}

let inFlight: Promise<void> | null = null

/** Fetches the switches. Calls made while one is running share it. */
export function refreshKillSwitches(): Promise<void> {
    inFlight ??= fetchKillSwitches().finally(() => {
        inFlight = null
    })
    return inFlight
}

let started = false

/** Fetches now and again each time the user comes back to the app. No polling. */
export function startKillSwitches(): void {
    if (started || typeof window === 'undefined') return
    started = true
    void refreshKillSwitches()
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void refreshKillSwitches()
    })
    // Android WebViews do not reliably fire visibilitychange on resume
    if (isCapacitor()) {
        void import('@capacitor/app')
            .then(({ App }) =>
                App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) void refreshKillSwitches()
                })
            )
            .catch(() => {})
    }
}
