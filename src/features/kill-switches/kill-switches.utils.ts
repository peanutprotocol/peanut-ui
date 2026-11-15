import { DEFAULT_KILL_SWITCHES, FULL_MAINTENANCE_ALLOWED_PATHS } from './kill-switches.consts'
import type { AppUpdateCutoffs, KillSwitches } from './kill-switches.types'

type Key = keyof KillSwitches

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')

// a value counts only if it has the same shape as the default for its key
const isValidValue = (key: Key, value: unknown): boolean =>
    Array.isArray(DEFAULT_KILL_SWITCHES[key]) ? isStringArray(value) : typeof value === 'boolean'

/** Empty is a confirmed policy with no critical cutoff. Invalid or absent is unknown. */
export function parseAppUpdateCutoffs(raw: unknown): AppUpdateCutoffs | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const prototype = Object.getPrototypeOf(raw)
    if (prototype !== Object.prototype && prototype !== null) return undefined

    const cutoffs: AppUpdateCutoffs = {}
    for (const key of Reflect.ownKeys(raw)) {
        if (key !== 'ios' && key !== 'android') return undefined
        const value = (raw as Record<string, unknown>)[key]
        if (typeof value !== 'string') return undefined
        if (key === 'ios') {
            if (!/^(?:0|[1-9][0-9]{0,8})(?:\.(?:0|[1-9][0-9]{0,8})){0,2}$/.test(value) || !/[1-9]/.test(value))
                return undefined
        } else if (!/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > 2_100_000_000) {
            return undefined
        }
        cutoffs[key] = value
    }
    return cutoffs
}

/** Keeps only known keys whose value has the right type. Anything else becomes {}. */
export function sanitizeKillSwitches(raw: unknown): Partial<KillSwitches> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(DEFAULT_KILL_SWITCHES) as Key[]) {
        const value = (raw as Record<string, unknown>)[key]
        if (isValidValue(key, value)) result[key] = value
    }
    // ponytail: list entries are not checked against the provider/currency unions; an unknown entry never matches
    return result as Partial<KillSwitches>
}

/** Per key: server value, else saved value, else the built-in default. */
export function resolveKillSwitches(server: unknown, saved: unknown): KillSwitches {
    return { ...DEFAULT_KILL_SWITCHES, ...sanitizeKillSwitches(saved), ...sanitizeKillSwitches(server) }
}

/**
 * Where full maintenance should send this page, or null to stay.
 *
 * Going in is immediate, on saved or default values. Leaving /maintenance waits
 * for the API to answer (`answered`), so a stale "off" never bounces the user to
 * /home and back. Demo mode (the app-store review sandbox, no real API) never
 * redirects either way, so a stale saved value cannot lock reviewers out.
 */
export function maintenanceRedirectTarget(
    pathname: string | null,
    enableFullMaintenance: boolean,
    demoMode: boolean,
    answered: boolean
): '/maintenance' | '/home' | null {
    if (!pathname || demoMode) return null
    // the native export uses trailing slashes
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    if (!enableFullMaintenance) return path === '/maintenance' && answered ? '/home' : null
    return FULL_MAINTENANCE_ALLOWED_PATHS.includes(path) ? null : '/maintenance'
}
