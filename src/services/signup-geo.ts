import { apiFetch } from '@/utils/api-fetch'
import { getClearEpoch } from '@/utils/auth-token'
import { isNativeBridge } from '@/utils/capacitor'
import type { SignupGeo } from '@/interfaces/interfaces'
import {
    currentSetupCountrySignals,
    startSetupCountrySignals,
    subscribeSetupCountrySignals,
    type SetupCountrySignals,
} from '@/features/setup/country-signals'

const WINDOW_MS = 24 * 60 * 60_000
const KEY_PREFIX = 'peanut.signup-geo.v1.'
type Snapshot = SignupGeo['signup']
type Pending = { userId: string; expiresAt: number; signup: Snapshot; collecting?: boolean; delivered?: boolean }

export function signupGeoPayload(snapshot: SetupCountrySignals): Snapshot | null {
    const observedAt = snapshot.collectedAt
    if (!observedAt) return null
    return {
        ...(snapshot.vercelIpCountry && { vercelIp: { country: snapshot.vercelIpCountry, observedAt } }),
        ...(snapshot.ipCountry && {
            ipProvider: { country: snapshot.ipCountry, provider: 'ipapi' as const, observedAt },
        }),
        ...(snapshot.storeCountry &&
            snapshot.storeCountryCollectedAt && {
                store: {
                    country: snapshot.storeCountry.countryCode,
                    source: snapshot.storeCountry.source,
                    observedAt: snapshot.storeCountryCollectedAt,
                },
            }),
        ...((snapshot.deviceLanguage || snapshot.browserLanguages?.length || snapshot.deviceTimezone) && {
            device: {
                locale: snapshot.deviceLanguage ?? null,
                languages: snapshot.browserLanguages ?? [],
                timeZone: snapshot.deviceTimezone ?? null,
                observedAt,
            },
        }),
    }
}

/** Storage is account-scoped. Native Preferences survive WebView/process recreation. */
async function readPending(userId: string): Promise<Pending | null> {
    const key = KEY_PREFIX + encodeURIComponent(userId)
    try {
        const raw = isNativeBridge()
            ? (await (await import('@capacitor/preferences')).Preferences.get({ key })).value
            : window.localStorage.getItem(key)
        if (!raw || raw.length > 16_384) return null
        const pending: Pending = JSON.parse(raw)
        if (
            pending.userId !== userId ||
            !Number.isFinite(pending.expiresAt) ||
            pending.expiresAt > Date.now() + WINDOW_MS + 60_000 ||
            !pending.signup ||
            typeof pending.signup !== 'object' ||
            Array.isArray(pending.signup)
        )
            return null
        return pending
    } catch {
        return null
    }
}
async function storePending(userId: string, pending: Pending | null): Promise<void> {
    const key = KEY_PREFIX + encodeURIComponent(userId)
    if (isNativeBridge()) {
        const { Preferences } = await import('@capacitor/preferences')
        if (pending) await Preferences.set({ key, value: JSON.stringify(pending) })
        else await Preferences.remove({ key })
    } else if (pending) window.localStorage.setItem(key, JSON.stringify(pending))
    else window.localStorage.removeItem(key)
}

function mergeSignals(previous: Snapshot, incoming: Snapshot): Snapshot {
    const merged = { ...incoming, ...previous }
    if (previous.device && incoming.device)
        merged.device = {
            ...previous.device,
            locale: previous.device.locale || incoming.device.locale,
            languages: previous.device.languages.length ? previous.device.languages : incoming.device.languages,
            timeZone: previous.device.timeZone || incoming.device.timeZone,
        }
    return merged
}

let active: { userId: string; stop: () => void; capture: () => Promise<void> } | null = null

/** Resume only this account's saved observations, without collecting a new signup snapshot. */
export function resumeSignupGeo(userId: string): () => void {
    if (typeof window === 'undefined') return () => {}
    if (active?.userId === userId) return active.stop
    active?.stop()
    let stopped = false
    let pending: Pending | null = null
    let inFlight = false
    let attempts = 0
    let retry: ReturnType<typeof setTimeout> | undefined
    let captureDeadline: ReturnType<typeof setTimeout> | undefined
    let unsubscribe: (() => void) | undefined
    let nativeUnsubscribe: (() => void) | undefined
    const epoch = getClearEpoch()
    const controller = new AbortController()
    const current = () => !stopped && epoch === getClearEpoch()
    // Serialize persistence and acknowledgements so a slow write cannot resurrect an acknowledged snapshot.
    let writes: Promise<void> = readPending(userId)
        .then(async (saved) => {
            if (!current()) return
            pending = saved && saved.expiresAt > Date.now() ? saved : null
            if (saved && !pending) await storePending(userId, null)
        })
        .catch(() => {})
    const enqueue = (operation: () => Promise<void>) => {
        writes = writes.then(operation).catch(() => {
            /* Retain the in-memory pending value on storage failure. */
        })
        return writes
    }
    const schedule = () => {
        clearTimeout(retry)
        if (!current() || !pending || pending.delivered) return
        const remaining = pending.expiresAt - Date.now()
        retry = setTimeout(
            () => void flush(),
            Math.max(0, Math.min(remaining, Math.min(60_000, 1000 * 2 ** Math.min(attempts++, 6))))
        )
    }
    const flush = async () => {
        await writes
        if (!current() || inFlight || !pending) return
        if (pending.expiresAt <= Date.now()) {
            await enqueue(async () => {
                pending = null
                await storePending(userId, null)
            })
            return
        }
        if (pending.delivered) return
        inFlight = true
        const sent = pending
        try {
            const response = await apiFetch('/users/me/geo', {
                method: 'POST',
                body: JSON.stringify({ expectedUserId: userId, signup: sent.signup }),
                timeoutMs: 3000,
                redactTelemetry: true,
                signal: controller.signal,
            })
            if (!current()) return
            // Keep observations for the original account on logout/session conflict; never rebind them.
            if (response.status === 401 || response.status === 403 || response.status === 409) {
                stop()
                return
            }
            const acknowledged = response.ok && (await response.json()).accepted === true
            const terminal = response.status === 400 || (response.ok && !acknowledged)
            if (acknowledged || terminal) {
                attempts = 0
                await enqueue(async () => {
                    if (!current()) return
                    if (terminal) pending = null
                    else if (pending && JSON.stringify(pending.signup) === JSON.stringify(sent.signup)) {
                        pending = pending.collecting ? { ...pending, delivered: true } : null
                    }
                    await storePending(userId, pending)
                })
            }
        } catch {
            /* Network failure retains the durable queue and schedules an independent retry. */
        } finally {
            inFlight = false
            schedule()
        }
    }
    const capture = async () => {
        const signup = signupGeoPayload(currentSetupCountrySignals())
        if (!signup || !Object.keys(signup).length) return
        await enqueue(async () => {
            if (!current()) return
            const merged = mergeSignals(pending?.signup ?? {}, signup)
            if (pending && JSON.stringify(merged) === JSON.stringify(pending.signup)) return
            pending = {
                userId,
                expiresAt: pending?.expiresAt ?? Date.now() + WINDOW_MS,
                signup: merged,
                collecting: true,
                delivered: false,
            }
            await storePending(userId, pending)
        })
        void flush()
    }
    const onWake = () => {
        if (document.visibilityState !== 'hidden') void flush()
    }
    const stop = () => {
        stopped = true
        controller.abort()
        clearTimeout(retry)
        clearTimeout(captureDeadline)
        unsubscribe?.()
        nativeUnsubscribe?.()
        window.removeEventListener('online', onWake)
        window.removeEventListener('focus', onWake)
        document.removeEventListener('visibilitychange', onWake)
        if (active?.stop === stop) active = null
    }
    active = {
        userId,
        stop,
        capture: async () => {
            if (!unsubscribe) {
                unsubscribe = subscribeSetupCountrySignals(() => void capture())
                captureDeadline = setTimeout(() => {
                    unsubscribe?.()
                    unsubscribe = undefined
                    void enqueue(async () => {
                        if (!current() || !pending) return
                        pending = pending.delivered ? null : { ...pending, collecting: false }
                        await storePending(userId, pending)
                    }).then(flush)
                }, 10_000)
                void startSetupCountrySignals()
                    .then(capture)
                    .catch(() => {})
            }
            await capture()
            void flush()
        },
    }
    if (isNativeBridge()) {
        void import('@capacitor/app')
            .then(async ({ App }) => {
                const handle = await App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) void flush()
                })
                if (!current()) await handle.remove()
                else
                    nativeUnsubscribe = () => {
                        void handle.remove()
                    }
            })
            .catch(() => {})
    }
    window.addEventListener('online', onWake)
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    void writes.then(() => {
        // A crash after an early acknowledgement must still resume unfinished source collection.
        if (current() && pending?.collecting) void active?.capture()
        else void flush()
    })
    return stop
}

/** Persist before signup redirects; delivery and late collection continue in the auth provider. */
export async function attachSignupGeo(userId: string): Promise<void> {
    resumeSignupGeo(userId)
    await active?.capture()
}
