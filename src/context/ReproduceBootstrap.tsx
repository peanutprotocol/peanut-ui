'use client'

/**
 * Reproduce-from-screenshot bootstrap.
 *
 * When the URL includes `?__reproduce=<sessionId>`, this provider fetches the
 * reproduce manifest from the harness API, clears all client state left by the
 * previous session AND the previous build (service workers, every cache, both
 * web storages, IndexedDB, the jwt cookie), seeds the new scenario user's
 * state, and reloads — landing the page in the exact authenticated state the
 * screenshot captured, with no carryover from any previous reproduce session.
 *
 * Gated by NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK=true. In prod this
 * component is dead code.
 *
 * See:
 *   - mono/engineering/qa/VERIFICATION-PLAN.md §13a
 *   - mono/peanut-api-ts submodule — /dev/reproduce route
 */

import { useEffect } from 'react'

const COOKIE_NAME = 'jwt-token'
const SESSION_STORAGE_KEY = '__reproduce_applied'

function setCookie(name: string, value: string, maxAgeSeconds = 3600) {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

function clearCookie(name: string) {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

/** how long any one browser-storage call may take before it is skipped */
const STEP_TIMEOUT_MS = 3000
/** how long the whole bootstrap may take before the param is stripped anyway */
const WATCHDOG_MS = 8000

/** the same URL without the reproduce param — where the document ends up */
function cleanUrl(): string {
    const url = new URL(window.location.href)
    url.searchParams.delete('__reproduce')
    return url.pathname + url.search
}

/**
 * Run one wipe step, and give up on it after three seconds.
 *
 * `navigator.serviceWorker.getRegistrations()`, `caches.keys()` and
 * `indexedDB.databases()` can all sit there without resolving or throwing
 * while a worker is mid-update — which is precisely the browser state a
 * reproduce link arrives in. One of them hanging used to stop the bootstrap
 * between its start line and the reload, with nothing in the log. A skipped
 * step is survivable; a bootstrap that never finishes is not.
 */
async function step(name: string, work: () => Promise<unknown>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        await Promise.race([
            work(),
            new Promise<void>((resolve) => {
                timer = setTimeout(() => {
                    console.info('[reproduce] step timed out, skipping', name)
                    resolve()
                }, STEP_TIMEOUT_MS)
            }),
        ])
    } catch (err) {
        console.info('[reproduce] step failed, carrying on', name, err)
    } finally {
        if (timer) clearTimeout(timer)
    }
}

// Wipe every piece of user-scoped client state BEFORE seeding the new session.
//
// A stale build is as damaging as a stale user here. The service worker of the
// previous QA build keeps serving its own app shell and its cached /users/me,
// so a reproduce link opens the old bundle holding a token the API now answers
// 401 to — and the app spins instead of recovering. Unregister first, then
// drop EVERY cache (not only the user-data ones: the app shell is the half
// that pins the old build), then clear both web storages.
//
// Order matters: a running worker can repopulate a cache it still owns.
//
// `sessionId` is the one thing this deliberately puts back: clearing
// sessionStorage would take the applied marker with it, and a second run that
// found no marker would wipe everything the first run had just seeded.
async function wipeUserScopedClientState(sessionId: string) {
    // Cookies — expire the jwt unconditionally. Will be re-set with new value.
    clearCookie(COOKIE_NAME)

    // Unregister ALL service workers for this origin. A running SW can serve
    // stale responses from in-memory state even after caches.delete(), and
    // can re-populate caches before our new cookie arrives. Full unregister
    // forces the next page load to hit the network directly.
    await step('service workers', async () => {
        if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
    })

    // Every Cache Storage entry: cached API responses carry the previous user,
    // the precache carries the previous build.
    await step('caches', async () => {
        if (typeof caches === 'undefined') return
        const names = await caches.keys()
        await Promise.all(names.map((n) => caches.delete(n)))
    })

    // localStorage — webauthn keys, kernel state, the TanStack Query
    // persister; sessionStorage — the replay handoff. Both are re-seeded below
    // from the new manifest.
    try {
        localStorage.clear()
    } catch {}
    try {
        sessionStorage.clear()
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    } catch {}

    // IndexedDB — TanStack Query persister and anything else that survived a
    // tab close. Wipe all databases (dev-only, harness-only).
    await step('indexeddb', async () => {
        if (typeof indexedDB === 'undefined' || !indexedDB.databases) return
        const dbs = await indexedDB.databases()
        await Promise.all(
            (dbs || []).map(
                (db) =>
                    new Promise<void>((resolve) => {
                        if (!db.name) return resolve()
                        const req = indexedDB.deleteDatabase(db.name)
                        req.onsuccess = () => resolve()
                        req.onerror = () => resolve()
                        req.onblocked = () => resolve()
                    })
            )
        )
    })
}

export function ReproduceBootstrap() {
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK !== 'true') return
        if (typeof window === 'undefined') return

        let cancelled = false
        let watchdog: ReturnType<typeof setTimeout> | undefined

        /**
         * Leave the reproduce URL, once.
         *
         * A full navigation, not `reload()`: the param has to be gone from the
         * document that comes back, and a reload after a `replaceState` was
         * racing that rewrite. Every provider reinitialises either way.
         */
        const leaveReproduceUrl = (why: string, sessionId: string) => {
            if (watchdog) clearTimeout(watchdog)
            watchdog = undefined
            const target = cleanUrl()
            console.info(`[reproduce] ${why}`, sessionId, target)
            window.location.replace(target)
        }

        const apply = async (sessionId: string, apiBase: string) => {
            try {
                const res = await fetch(`${apiBase}/dev/reproduce/${encodeURIComponent(sessionId)}`)
                if (!res.ok) {
                    console.error('[reproduce] manifest fetch failed', res.status, sessionId)
                    sessionStorage.removeItem(SESSION_STORAGE_KEY)
                    return
                }
                const manifest = await res.json()
                if (cancelled) return
                console.info('[reproduce] manifest ok', sessionId)

                // Step 1: wipe the prior session AND the prior build.
                await wipeUserScopedClientState(sessionId)
                console.info('[reproduce] wipe done', sessionId)

                // Step 2: seed localStorage flags from the new manifest. The
                // manifest.localStorage map carries harness flags (ecdsa pk
                // etc.) plus any app-prefix localStorage keys the runner
                // captured at screenshot time (recent methods, user prefs).
                for (const [k, v] of Object.entries(manifest.localStorage ?? {})) {
                    if (v == null) continue
                    try {
                        localStorage.setItem(k, String(v))
                    } catch {}
                }
                // Step 2b: stash action descriptors for HarnessReplay to pick
                // up after the reload. The replay component fires once, then
                // clears this key. See context/HarnessReplay.tsx.
                if (Array.isArray(manifest.stepActions) && manifest.stepActions.length > 0) {
                    try {
                        sessionStorage.setItem('__harness_replay_actions', JSON.stringify(manifest.stepActions))
                    } catch {}
                }
                // Step 3: set the jwt-token cookie so the UI treats the user as
                // signed in as the scenario's user.
                if (manifest.token) setCookie(COOKIE_NAME, manifest.token, 1800)
                console.info('[reproduce] seed done', sessionId)

                leaveReproduceUrl('reloading', sessionId)
            } catch (err) {
                // Loud, not silent: a swallowed failure here looks exactly like
                // the loader that never resolves, and the QA log is the only
                // place anyone can tell the two apart.
                console.error('[reproduce] bootstrap failed', sessionId, err)
                // Let a later attempt at the same link through: a half-applied
                // session is worse than one that says it never started.
                try {
                    sessionStorage.removeItem(SESSION_STORAGE_KEY)
                } catch {}
            }
        }

        // window.location, not useSearchParams: that hook makes this component
        // a Suspense-bailout consumer, so the boundary it sits in has to
        // resolve before the effect can run at all. Reading the live URL also
        // means a second link reaching this same document is seen.
        const run = () => {
            const sessionId = new URLSearchParams(window.location.search).get('__reproduce')
            if (!sessionId) return
            // The marker is the ONE guard, and it is written below before any
            // side effect: a remount, a popstate and a pageshow all land here,
            // and two runs of the same link fetched two manifests and wiped
            // each other's seeded state. It also survives the navigation this
            // ends in, so the link is not replayed afterwards.
            if (sessionStorage.getItem(SESSION_STORAGE_KEY) === sessionId) return

            const apiBase = process.env.NEXT_PUBLIC_PEANUT_API_URL || ''
            if (!apiBase) {
                console.error('[reproduce] no API base is configured, so no manifest can be fetched', sessionId)
                return
            }

            // Synchronously, before the first await: anything later is a race.
            sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
            console.info('[reproduce] bootstrap start', sessionId)

            // Last resort. Whatever went wrong, the document must not sit on a
            // reproduce URL showing a loader: leave it and let the app render
            // as whoever the browser now is.
            watchdog = setTimeout(() => {
                if (!new URLSearchParams(window.location.search).get('__reproduce')) return
                leaveReproduceUrl('watchdog', sessionId)
            }, WATCHDOG_MS)

            void apply(sessionId, apiBase)
        }

        run()
        // A reproduce link can also arrive without a fresh mount: back/forward
        // through one, or a restore from the back-forward cache.
        window.addEventListener('popstate', run)
        window.addEventListener('pageshow', run)

        return () => {
            cancelled = true
            if (watchdog) clearTimeout(watchdog)
            window.removeEventListener('popstate', run)
            window.removeEventListener('pageshow', run)
        }
        // Mount-scoped: `run` reads the live URL every time it fires, so there
        // is no value to depend on.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return null
}
