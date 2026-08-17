// One-shot startup probes for the WebView fetch path the app actually uses
// with CapacitorHttp disabled (PEANUT-UI-R44). Probes go through the live
// window.fetch rather than forcing the un-proxied path, so they measure what
// real traffic hits; the `transport` tag records whether a CapacitorHttp proxy
// was in front of it. Five probes discriminate the failure modes seen in the
// field (PEANUT-UI-R5F):
//   get-healthz        — unauthenticated simple GET: pure reachability, no preflight
//   get-users-me       — GET with Authorization, exactly like callApi (preflighted)
//   post-healthz       — POST with JSON content-type: any HTTP status (404/405 is
//                        fine) proves the method works, testing the GET-vs-POST
//                        asymmetry observed on-device
//   get-healthz-nocors — mode:'no-cors' GET: an `opaque` outcome where the plain
//                        GET fails means the server DID respond but without CORS
//                        headers — i.e. an edge block/challenge page, not a dead
//                        network
//   get-healthz-native — same GET over CapacitorHttp.request (OS HTTP client):
//                        succeeds where the WebView is fingerprint-blocked
// Each probe gets its own message ("direct-fetch canary <probe>") — identical
// messages were collapsed by Sentry's dedupe integration in v2, which is why
// only the first probe's event ever arrived.
// Query: message:"direct-fetch canary" — tags: probe, outcome, transport,
// appVersion; extras carry durationMs and the rejection error. swControlled is
// set globally in instrumentation-client.ts, so it lands on these events too.

import * as Sentry from '@sentry/nextjs'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { authReady, getAuthToken } from './auth-token'
import { isCapacitor } from './capacitor'
import { getUnderlyingFetch } from './native-auth-capture'
import { nativeHttpRequest } from './native-http'

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

function toProbeError(error: unknown, startedAt: number): ProbeResult {
    const e = error instanceof Error ? error : new Error(String(error))
    return {
        outcome: e.name === 'AbortError' ? 'timeout' : 'network-error',
        durationMs: Date.now() - startedAt,
        errorName: e.name,
        // Android WebView TypeErrors carry net:: codes in the message
        errorMessage: e.message,
    }
}

async function probe(path: string, init: RequestInit): Promise<ProbeResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CANARY_TIMEOUT_MS)
    const startedAt = Date.now()
    try {
        const response = await fetch(`${PEANUT_API_URL}${path}`, { ...init, signal: controller.signal })
        // no-cors responses are status 0 by design; `opaque` = the server answered
        return {
            outcome: response.type === 'opaque' ? 'opaque' : `http-${response.status}`,
            durationMs: Date.now() - startedAt,
        }
    } catch (error) {
        return toProbeError(error, startedAt)
    } finally {
        clearTimeout(timeoutId)
    }
}

async function nativeProbe(path: string): Promise<ProbeResult> {
    const startedAt = Date.now()
    try {
        const response = await nativeHttpRequest(`${PEANUT_API_URL}${path}`, { method: 'GET' }, CANARY_TIMEOUT_MS)
        return { outcome: `http-${response.status}`, durationMs: Date.now() - startedAt }
    } catch (error) {
        return toProbeError(error, startedAt)
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
    // Compare against the fetch that native-auth-capture found at install time —
    // its own wrapper patches window.fetch too, which made v2 report
    // cap-http-proxy on binaries where the proxy is off.
    const capWebFetch = (window as unknown as { CapacitorWebFetch?: typeof fetch }).CapacitorWebFetch
    const baseFetch = getUnderlyingFetch() ?? window.fetch
    const proxied = !!capWebFetch && baseFetch !== capWebFetch

    const { appVersion, appBuild } = await getBinaryInfo()

    const webTransport = proxied ? 'cap-http-proxy' : 'direct'
    const probes: Array<{ name: string; transport: string; run: () => Promise<ProbeResult> }> = [
        { name: 'get-healthz', transport: webTransport, run: () => probe('/healthz', { method: 'GET' }) },
        {
            name: 'get-users-me',
            transport: webTransport,
            run: () =>
                probe('/users/me', { method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        },
        {
            name: 'post-healthz',
            transport: webTransport,
            run: () =>
                probe('/healthz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
        },
        {
            name: 'get-healthz-nocors',
            transport: webTransport,
            run: () => probe('/healthz', { method: 'GET', mode: 'no-cors' }),
        },
        { name: 'get-healthz-native', transport: 'cap-native-http', run: () => nativeProbe('/healthz') },
    ]

    // Fire in parallel so a dead network costs one CANARY_TIMEOUT_MS, not five,
    // then report in probe order so the Sentry events stay comparable run to run.
    const results = await Promise.all(probes.map(({ run }) => run()))

    probes.forEach(({ name, transport }, index) => {
        const result = results[index]
        // probe name in the message: identical messages hit Sentry's dedupe
        // integration and only the first probe's event survives
        Sentry.captureMessage(`direct-fetch canary ${name}`, {
            level: 'info',
            tags: {
                canary: 'direct-fetch',
                canaryVersion: '3',
                probe: name,
                outcome: result.outcome,
                transport,
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
