/*
 * Startup transport canary — restored, failure-only.
 *
 * The retired v3 canary (`c45f7655`) answered the question this app could not
 * answer any other way: on Android, a WebView GET fails while a POST and an
 * OS-client GET to the same host in the same second succeed. No per-failure
 * error report can show that, because the comparison IS the evidence — it is
 * what ruled out both "the network was down" and "Cloudflare blocked them".
 *
 * It was retired for real cost: five `captureMessage` calls per launch on
 * every platform (~550 events/day, all `level:info`) plus five extra round
 * trips on every cold start. This restores the signal without the bill:
 *
 * - ONE event per launch, and only when something actually failed. A clean
 *   launch reports nothing at all, so the steady-state cost is zero.
 * - Three probes, not five. `get-users-me` added an auth variable to a
 *   reachability question, and `get-healthz-nocors` is unusable — see below.
 * - `level:warning`, so this can never rejoin the `level:info` flood that
 *   made the original a deletion target.
 *
 * NO `no-cors` PROBE, which is what makes this safe to run on iOS. WKWebView
 * serves no opaque responses at all: the retired canary measured that probe
 * failing 108/108 on iOS while every other probe in the same batch succeeded
 * 100%. Including it would mean every iOS launch reports a failure that did
 * not happen. It is also blocked by `Cross-Origin-Resource-Policy: same-site`
 * on `/healthz` from the native `https://localhost` origin until
 * peanut-api-ts#1456 deploys. All three probes below are ordinary CORS
 * requests, so they mean the same thing on both platforms.
 *
 * Denominator lives in PostHog (app opens), not here — that is the whole
 * reason this can skip success events. Note PostHog's registered device
 * context carries `platform` but NOT the app version, so per-build rates
 * (the split that surfaced 3% on `8016c68` vs 21% on `d4bd3ab`) need
 * `app_version` added to that `posthog.register` call to be reproducible.
 *
 * Query: message starts `native canary:` — the message carries the outcome
 * signature so each distinct failure shape is its own Sentry issue.
 */

import * as Sentry from '@sentry/nextjs'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { isNativeBridge } from './capacitor'
import { getBinaryInfo } from './app-version'
import { getUnderlyingFetch } from './native-auth-capture'
import { nativeHttpRequest } from './native-http'

const CANARY_TIMEOUT_MS = 10_000

let scheduled = false

interface ProbeResult {
    outcome: string
    durationMs: number
    errorName?: string
    errorMessage?: string
}

function isFailure(result: ProbeResult): boolean {
    return result.outcome === 'timeout' || result.outcome === 'network-error'
}

function toProbeError(error: unknown, startedAt: number): ProbeResult {
    const e = error instanceof Error ? error : new Error(String(error))
    return {
        outcome: e.name === 'AbortError' ? 'timeout' : 'network-error',
        durationMs: Date.now() - startedAt,
        errorName: e.name,
        // Android WebView TypeErrors carry net:: codes in the message — the
        // one field most likely to name the actual root cause
        errorMessage: e.message,
    }
}

async function probe(path: string, init: RequestInit): Promise<ProbeResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CANARY_TIMEOUT_MS)
    const startedAt = Date.now()
    try {
        const response = await fetch(`${PEANUT_API_URL}${path}`, { ...init, signal: controller.signal })
        // any HTTP status counts as success: 404/405 still proves the request
        // completed end to end, which is the only thing being measured
        return { outcome: `http-${response.status}`, durationMs: Date.now() - startedAt }
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

export async function runCanary(): Promise<void> {
    const probes = [
        { name: 'get', transport: 'webview', run: () => probe('/healthz', { method: 'GET' }) },
        {
            name: 'post',
            transport: 'webview',
            run: () =>
                probe('/healthz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
        },
        { name: 'native', transport: 'cap-native-http', run: () => nativeProbe('/healthz') },
    ]

    // Parallel so a dead network costs one CANARY_TIMEOUT_MS, not three.
    const results = await Promise.all(probes.map(({ run }) => run()))
    if (!results.some(isFailure)) return

    const outcomes = Object.fromEntries(probes.map(({ name }, i) => [name, results[i].outcome]))
    const signature = probes.map(({ name }, i) => `${name}:${isFailure(results[i]) ? 'fail' : 'ok'}`).join(' ')

    // CapacitorWebFetch is assigned unconditionally by the native bridge; only
    // an actual patch of window.fetch means the CapacitorHttp proxy is active.
    const capWebFetch = (window as unknown as { CapacitorWebFetch?: typeof fetch }).CapacitorWebFetch
    const baseFetch = getUnderlyingFetch() ?? window.fetch
    const { appVersion, appBuild } = (await getBinaryInfo()) ?? { appVersion: 'unknown', appBuild: 'unknown' }

    Sentry.captureMessage(`native canary: ${signature}`, {
        level: 'warning',
        tags: {
            canary: 'transport',
            canaryVersion: '4',
            canary_signature: signature,
            canary_get: outcomes.get,
            canary_post: outcomes.post,
            canary_native: outcomes.native,
            webviewTransport: !!capWebFetch && baseFetch !== capWebFetch ? 'cap-http-proxy' : 'direct',
            appVersion,
            appBuild,
            online: String(navigator.onLine),
        },
        extra: Object.fromEntries(
            probes.map(({ name }, i) => [
                name,
                {
                    durationMs: results[i].durationMs,
                    errorName: results[i].errorName,
                    errorMessage: results[i].errorMessage,
                },
            ])
        ),
    })
}

/*
 * isNativeBridge, NOT isCapacitor: the latter is true for
 * NEXT_PUBLIC_CAPACITOR_BUILD Vercel previews, which have no bridge at all.
 * Running there would drive the CapacitorHttp probe through a plugin that
 * cannot work and file the result as native transport evidence, under
 * appVersion 'unknown' — fabricated data in the one dataset this exists to
 * keep clean.
 */
export function scheduleTransportCanary(delayMs: number = 4_000): void {
    if (!isNativeBridge() || scheduled || typeof window === 'undefined') return
    scheduled = true
    setTimeout(() => {
        void runCanary().catch(() => {
            // a canary that breaks the app is worse than no canary
        })
    }, delayMs)
}
