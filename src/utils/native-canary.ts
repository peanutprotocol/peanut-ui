// One-shot startup probes for the WebView fetch path the app actually uses
// with CapacitorHttp disabled (PEANUT-UI-R44). Probes go through the live
// window.fetch rather than forcing the un-proxied path, so they measure what
// real traffic hits; the `transport` tag records whether a CapacitorHttp proxy
// was in front of it. Three probes discriminate the failure modes seen in the
// field (PEANUT-UI-R5F):
//   get-healthz   — unauthenticated simple GET: pure reachability, no preflight
//   get-users-me  — GET with Authorization, exactly like callApi (preflighted)
//   post-healthz  — POST with JSON content-type: any HTTP status (404/405 is
//                   fine) proves the method works, testing the GET-vs-POST
//                   asymmetry observed on-device
// Query: message:"direct-fetch canary" — tags: probe, outcome, transport,
// appVersion; extras carry durationMs and the rejection error. swControlled is
// set globally in instrumentation-client.ts, so it lands on these events too.

import * as Sentry from '@sentry/nextjs'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { authReady, getAuthToken } from './auth-token'
import { isCapacitor } from './capacitor'

const CANARY_TIMEOUT_MS = 10_000

let scheduled = false

export function scheduleDirectFetchCanary(delayMs: number = 4_000): void {
    if (!isCapacitor() || scheduled || typeof window === 'undefined') return
    scheduled = true
    setTimeout(() => {
        void runCanary()
    }, delayMs)
}

interface ProbeResult {
    outcome: string
    durationMs: number
    errorName?: string
    errorMessage?: string
}

async function probe(path: string, init: RequestInit): Promise<ProbeResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CANARY_TIMEOUT_MS)
    const startedAt = Date.now()
    try {
        const response = await fetch(`${PEANUT_API_URL}${path}`, { ...init, signal: controller.signal })
        return { outcome: `http-${response.status}`, durationMs: Date.now() - startedAt }
    } catch (error) {
        const e = error instanceof Error ? error : new Error(String(error))
        return {
            outcome: e.name === 'AbortError' ? 'timeout' : 'network-error',
            durationMs: Date.now() - startedAt,
            errorName: e.name,
            // Android WebView TypeErrors carry net:: codes in the message
            errorMessage: e.message,
        }
    } finally {
        clearTimeout(timeoutId)
    }
}

async function getBinaryInfo(): Promise<{ appVersion: string; appBuild: string }> {
    try {
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        return { appVersion: info.version, appBuild: info.build }
    } catch {
        return { appVersion: 'unknown', appBuild: 'unknown' }
    }
}

async function runCanary(): Promise<void> {
    await authReady()
    const token = getAuthToken()

    // CapacitorWebFetch is assigned unconditionally by the native bridge; only
    // an actual patch of window.fetch means the CapacitorHttp proxy is active.
    const capWebFetch = (window as unknown as { CapacitorWebFetch?: typeof fetch }).CapacitorWebFetch
    const proxied = !!capWebFetch && window.fetch !== capWebFetch

    const { appVersion, appBuild } = await getBinaryInfo()

    const probes: Array<{ name: string; path: string; init: RequestInit }> = [
        { name: 'get-healthz', path: '/healthz', init: { method: 'GET' } },
        {
            name: 'get-users-me',
            path: '/users/me',
            init: { method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} },
        },
        {
            name: 'post-healthz',
            path: '/healthz',
            init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
        },
    ]

    // Fire in parallel so a dead network costs one CANARY_TIMEOUT_MS, not three,
    // then report in probe order so the Sentry events stay comparable run to run.
    const results = await Promise.all(probes.map(({ path, init }) => probe(path, init)))

    probes.forEach(({ name }, index) => {
        const result = results[index]
        Sentry.captureMessage('direct-fetch canary', {
            level: 'info',
            tags: {
                canary: 'direct-fetch',
                canaryVersion: '2',
                probe: name,
                outcome: result.outcome,
                transport: proxied ? 'cap-http-proxy' : 'direct',
                authMode: token ? 'bearer' : 'none',
                appVersion,
                appBuild,
                online: String(navigator.onLine),
            },
            extra: {
                durationMs: result.durationMs,
                errorName: result.errorName,
                errorMessage: result.errorMessage,
            },
        })
    })
}
