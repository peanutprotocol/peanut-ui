'use client'

/**
 * Reproduce-from-screenshot bootstrap.
 *
 * When the URL includes `?__reproduce=<sessionId>`, this provider fetches the
 * reproduce manifest from the harness API, clears all user-scoped client
 * state (service-worker caches, harness localStorage, jwt cookie), seeds the
 * new scenario user's state, and reloads — landing the page in the exact
 * authenticated state the screenshot captured, with no carryover from any
 * previous reproduce session.
 *
 * Gated by NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK=true. In prod this
 * component is dead code.
 *
 * See:
 *   - mono/engineering/qa/VERIFICATION-PLAN.md §13a
 *   - mono/peanut-api-ts submodule — /dev/reproduce route
 */

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { USER_DATA_CACHE_PATTERNS } from '@/constants/cache.consts'

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
// Otherwise:
//   - Service worker serves /users/me from a previous user's cache → the header
//     pill, balance, etc. render the WRONG user even after the cookie swap.
//   - localStorage keeps webauthn keys, kernel state, TanStack Query persister
//     data — any of which can surface the previous user's identity.
// Mirrors the logout() cleanup in authContext.tsx, minus the redirect.
async function wipeUserScopedClientState() {
    // Cookies — expire the jwt unconditionally. Will be re-set with new value.
    clearCookie(COOKIE_NAME)

    // localStorage — keep harness flags (we're about to set them fresh); wipe
    // everything else that might carry user identity.
    try {
        const preserve = new Set(['__reproduce_applied'])
        const keys = Object.keys(localStorage)
        for (const k of keys) {
            if (preserve.has(k)) continue
            // Keep a narrow allowlist only — anything else is suspect.
            try {
                localStorage.removeItem(k)
            } catch {}
        }
    } catch {}

    // Service-worker caches containing user-specific API responses.
    if (typeof caches !== 'undefined') {
        try {
            const names = await caches.keys()
            await Promise.all(
                names.filter((n) => USER_DATA_CACHE_PATTERNS.some((p) => n.includes(p))).map((n) => caches.delete(n))
            )
        } catch {}
    }

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
    const params = useSearchParams()
    const router = useRouter()

    useEffect(() => {
        if (process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK !== 'true') return
        const sessionId = params.get('__reproduce')
        if (!sessionId) return
        // Idempotent: sessionStorage flag prevents re-fetch on re-renders.
        if (sessionStorage.getItem(SESSION_STORAGE_KEY) === sessionId) return

        const apiBase = process.env.NEXT_PUBLIC_PEANUT_API_URL || ''
        if (!apiBase) return

        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch(`${apiBase}/dev/reproduce/${encodeURIComponent(sessionId)}`)
                if (!res.ok) {
                    console.warn('[reproduce] manifest fetch failed', res.status)
                    return
                }
                const manifest = await res.json()
                if (cancelled) return

                // Step 1: wipe prior user scope (cookies + caches + localStorage).
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
                console.warn('[reproduce] bootstrap failed', err)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [params, router])

    return null
}
