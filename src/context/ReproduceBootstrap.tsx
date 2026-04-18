'use client'

/**
 * Reproduce-from-screenshot bootstrap.
 *
 * When the URL includes `?__reproduce=<sessionId>`, this provider fetches the
 * reproduce manifest from the harness API, seeds localStorage (harness flags
 * + ECDSA pk if present), and sets the jwt-token cookie — landing the page
 * in the exact authenticated state the screenshot captured.
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

const COOKIE_NAME = 'jwt-token'
const SESSION_STORAGE_KEY = '__reproduce_applied'

function setCookie(name: string, value: string, maxAgeSeconds = 3600) {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
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

                // Seed localStorage flags from the manifest.
                for (const [k, v] of Object.entries(manifest.localStorage ?? {})) {
                    if (v == null) continue
                    try { localStorage.setItem(k, String(v)) } catch {}
                }
                // Set the jwt-token cookie so the UI treats the user as signed in.
                if (manifest.token) setCookie(COOKIE_NAME, manifest.token, 1800)

                sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)

                // Strip the ?__reproduce=... query param so reloads don't retrigger.
                const url = new URL(window.location.href)
                url.searchParams.delete('__reproduce')
                router.replace(url.pathname + url.search)

                // Force a hard reload so the kernel client + auth context
                // re-initialize with the freshly-seeded state. Without this
                // TanStack Query et al keep their stale pre-seed caches.
                setTimeout(() => window.location.reload(), 50)
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
