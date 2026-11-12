import { apiFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'
import { DEFAULT_KILL_SWITCHES, KILL_SWITCHES_PATH, KILL_SWITCHES_STORAGE_KEY } from './kill-switches.consts'
import type { AppUpdateCutoffs, KillSwitches } from './kill-switches.types'
import { parseAppUpdateCutoffs, resolveKillSwitches, sanitizeKillSwitches } from './kill-switches.utils'

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

// Update cutoffs are only trusted for the current native foreground. They never
// use the incident switches' persisted fallback.
interface NativeStoreUpdatePolicy {
    foreground: number | null
    cutoffs?: AppUpdateCutoffs
}
const inactiveUpdatePolicy: NativeStoreUpdatePolicy = { foreground: null }
let nativeUpdatePolicy = inactiveUpdatePolicy
let foregroundCount = 0

export const getNativeStoreUpdatePolicy = (): NativeStoreUpdatePolicy => nativeUpdatePolicy
export const getServerNativeStoreUpdatePolicy = (): NativeStoreUpdatePolicy => inactiveUpdatePolicy

// true once the API answered in this app session; until then the values are only saved or default
let answered = false

/** Current values, for code outside React. Components use `useKillSwitches`. */
export const getKillSwitches = (): KillSwitches => current

/** True once a fetch has answered in this app session. */
export const hasKillSwitchesAnswered = (): boolean => answered

export function subscribeKillSwitches(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

async function fetchKillSwitches(foreground: number | null): Promise<void> {
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
    const firstAnswer = !answered
    answered = true
    const cutoffs =
        foreground !== null && foreground === nativeUpdatePolicy.foreground && server && typeof server === 'object'
            ? parseAppUpdateCutoffs((server as Record<string, unknown>).appUpdateCutoffs)
            : undefined
    if (cutoffs) nativeUpdatePolicy = { foreground, cutoffs }
    if (JSON.stringify(next) !== JSON.stringify(current)) current = next
    else if (!firstAnswer && !cutoffs) return
    listeners.forEach((listener) => listener())
}

let inFlight: { foreground: number | null; request: Promise<void> } | null = null

/** Fetches the switches. Calls made while one is running share it. */
export function refreshKillSwitches(): Promise<void> {
    if (inFlight) return inFlight.request
    const { foreground, cutoffs } = nativeUpdatePolicy
    const request = fetchKillSwitches(foreground).finally(() => {
        inFlight = null
    })
    inFlight = { foreground, request }
    if (cutoffs) {
        nativeUpdatePolicy = { foreground }
        listeners.forEach((listener) => listener())
    }
    return request
}

function syncNativeForeground(isActive: boolean): void {
    if (isActive === (nativeUpdatePolicy.foreground !== null)) return
    const foreground = isActive ? ++foregroundCount : null
    nativeUpdatePolicy = foreground === null ? inactiveUpdatePolicy : { foreground }
    listeners.forEach((listener) => listener())
    if (foreground === null) return

    if (inFlight && inFlight.foreground !== foreground) {
        // A request from before the resume may still update incident switches,
        // but only a request begun this foreground can unlock update prompts.
        void inFlight.request.then(() => {
            if (nativeUpdatePolicy.foreground === foreground) void refreshKillSwitches()
        })
    } else {
        void refreshKillSwitches()
    }
}

let started = false

/** Fetches now and again each time the user comes back to the app. No polling. */
export function startKillSwitches(): void {
    if (started || typeof window === 'undefined') return
    started = true
    const native = isCapacitor()
    const isVisible = () => document.visibilityState === 'visible'
    if (native && isVisible()) syncNativeForeground(true)
    else void refreshKillSwitches()
    document.addEventListener('visibilitychange', () => {
        if (native) syncNativeForeground(isVisible())
        else if (isVisible()) void refreshKillSwitches()
    })
    // Android WebViews do not reliably fire visibilitychange on resume
    if (native) {
        void import('@capacitor/app')
            .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => syncNativeForeground(isActive)))
            .catch(() => {})
    }
}
