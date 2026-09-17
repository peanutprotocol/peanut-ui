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
async function wipeUserScopedClientState() {
    // Cookies — expire the jwt unconditionally. Will be re-set with new value.
    clearCookie(COOKIE_NAME)

    // Unregister ALL service workers for this origin. A running SW can serve
    // stale responses from in-memory state even after caches.delete(), and
    // can re-populate caches before our new cookie arrives. Full unregister
    // forces the next page load to hit the network directly.
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations()
            await Promise.all(regs.map((r) => r.unregister()))
        } catch {}
    }

    // Every Cache Storage entry: cached API responses carry the previous user,
    // the precache carries the previous build.
    if (typeof caches !== 'undefined') {
        try {
            const names = await caches.keys()
            await Promise.all(names.map((n) => caches.delete(n)))
        } catch {}
    }

    // localStorage — webauthn keys, kernel state, the TanStack Query
    // persister; sessionStorage — the replay handoff and this bootstrap's own
    // applied marker. Both are re-seeded below from the new manifest.
    try {
        localStorage.clear()
    } catch {}
    try {
        sessionStorage.clear()
    } catch {}

    // IndexedDB — TanStack Query persister and anything else that survived a
    // tab close. Wipe all databases (dev-only, harness-only).
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
        try {
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
        } catch {}
    }
}

export function ReproduceBootstrap() {
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK !== 'true') return
        if (typeof window === 'undefined') return

        let cancelled = false
        // The id being applied right now. The FIRST reproduce link used to be
        // the only one this document would ever honour: the effect read the
        // URL once and never looked again, so a second link opened in the same
        // tab left the app on its loader forever. The session id is the guard,
        // not the fact that the effect has run before.
        let applying: string | null = null

        const apply = async (sessionId: string, apiBase: string) => {
            try {
                const res = await fetch(`${apiBase}/dev/reproduce/${encodeURIComponent(sessionId)}`)
                if (!res.ok) {
                    console.error('[reproduce] manifest fetch failed', res.status, sessionId)
                    applying = null
                    return
                }
                const manifest = await res.json()
                if (cancelled) return

                // Step 1: wipe the prior session AND the prior build.
                await wipeUserScopedClientState()

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

                sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)

                // Step 4: strip the ?__reproduce=... query param so the reload
                // (and any future refresh) doesn't retrigger the bootstrap. Use
                // history.replaceState directly — Next.js's router.replace is
                // async and was racing with window.location.reload below,
                // leaving the param in the URL.
                const url = new URL(window.location.href)
                url.searchParams.delete('__reproduce')
                window.history.replaceState({}, '', url.pathname + url.search)

                // Step 5: hard reload so every provider (auth, kernel client,
                // TanStack Query) reinitializes against the freshly-seeded
                // state with no carryover from the pre-wipe session.
                window.location.reload()
            } catch (err) {
                // Loud, not silent: a swallowed failure here looks exactly like
                // the loader that never resolves, and the QA log is the only
                // place anyone can tell the two apart.
                console.error('[reproduce] bootstrap failed', sessionId, err)
                applying = null
            }
        }

        // window.location, not useSearchParams: that hook makes this component
        // a Suspense-bailout consumer, so the boundary it sits in has to
        // resolve before the effect can run at all. Reading the live URL also
        // means a second link reaching this same document is seen.
        const run = () => {
            const sessionId = new URLSearchParams(window.location.search).get('__reproduce')
            if (!sessionId || applying === sessionId) return
            // Idempotent across reloads: the applied marker survives the hard
            // reload this ends in, so the same link is not replayed.
            if (sessionStorage.getItem(SESSION_STORAGE_KEY) === sessionId) return

            const apiBase = process.env.NEXT_PUBLIC_PEANUT_API_URL || ''
            if (!apiBase) {
                console.error('[reproduce] no API base is configured, so no manifest can be fetched', sessionId)
                return
            }

            applying = sessionId
            console.info('[reproduce] bootstrap start', sessionId)
            void apply(sessionId, apiBase)
        }

        run()
        // A reproduce link can also arrive without a fresh mount: back/forward
        // through one, or a restore from the back-forward cache.
        window.addEventListener('popstate', run)
        window.addEventListener('pageshow', run)

        return () => {
            cancelled = true
            window.removeEventListener('popstate', run)
            window.removeEventListener('pageshow', run)
        }
        // Mount-scoped: `run` reads the live URL every time it fires, so there
        // is no value to depend on.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return null
}
