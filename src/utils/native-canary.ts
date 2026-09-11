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
 * - Three primary probes, not five. `get-users-me` added an auth variable to a
 *   reachability question, and `get-healthz-nocors` is unusable — see below.
 * - Native Capgo and public-internet control probes run only after all three
 *   primary probes fail. They separate an API-host incident from ordinary
 *   device connectivity without adding round trips to healthy launches.
 * - Asymmetric/API-host failures stay `warning`; whole-device connectivity is
 *   measured in PostHog and sampled into Sentry at `info` level.
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
 * reason this can skip success events. PostHog's registered device context
 * (locale-store.ts) carries `platform` plus `binary_version` / `binary_build`,
 * so per-build rates (the split that surfaced 3% on `8016c68` vs 21% on
 * `d4bd3ab`) can be reproduced by splitting on those.
 *
 * Query: message starts `native canary:`. An explicit fingerprint includes the
 * signature because the browser SDK attaches a synthetic stack to messages;
 * without it, Sentry groups every shape at this file's captureMessage callsite.
 */

import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { isNativeBridge } from './capacitor'
import { getBinaryInfo } from './app-version'
import { getUnderlyingFetch } from './passkey-auth-capture'
import { nativeHttpRequest } from './native-http'
import { readStoredValue, removeStoredValue, writeStoredValue } from './safe-storage'

const CANARY_TIMEOUT_MS = 10_000
const CAPGO_CONTROL_URL = 'https://plugin.capgo.app/'
const INTERNET_CONTROL_URL = 'https://www.gstatic.com/generate_204'
const CONNECTIVITY_SENTRY_SAMPLE_RATE = 0.1
const CONNECTIVITY_SENTRY_DAY_KEY = 'nativeCanaryConnectivitySentryDay'
const CONNECTIVITY_OUTBOX_KEY = 'nativeCanaryConnectivityOutboxV1'
const CONNECTIVITY_OUTBOX_RETENTION_DAYS = 7
const CANARY_EVENT_NAME = 'native_transport_canary_failed'

type CanaryClassification = 'transport-asymmetry' | 'api-unreachable' | 'device-connectivity'

let scheduled = false

interface ProbeResult {
    outcome: string
    durationMs: number
    errorName?: string
    errorMessage?: string
}

type CanaryEventProperties = Record<string, string | number | boolean | undefined>

interface PendingCanaryEvent {
    id: string
    day: string
    capturedAt: string
    lastReplayDay?: string
    properties: CanaryEventProperties
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

function timeoutError(): Error {
    return Object.assign(new Error('canary probe timed out'), { name: 'AbortError' })
}

async function probe(path: string, init: RequestInit): Promise<ProbeResult> {
    const controller = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()
    try {
        // Capacitor's fetch patch does not consistently honour AbortController.
        // Race the await as well, so the advertised ten-second budget remains a
        // wall-clock bound even when the request continues in native code.
        const response = await Promise.race([
            fetch(`${PEANUT_API_URL}${path}`, { ...init, signal: controller.signal }),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    controller.abort()
                    reject(timeoutError())
                }, CANARY_TIMEOUT_MS)
            }),
        ])
        // any HTTP status counts as success: 404/405 still proves the request
        // completed end to end, which is the only thing being measured
        return { outcome: `http-${response.status}`, durationMs: Date.now() - startedAt }
    } catch (error) {
        return toProbeError(error, startedAt)
    } finally {
        clearTimeout(timeoutId)
    }
}

async function nativeProbe(url: string): Promise<ProbeResult> {
    const startedAt = Date.now()
    try {
        const response = await nativeHttpRequest(url, { method: 'GET' }, CANARY_TIMEOUT_MS)
        return { outcome: `http-${response.status}`, durationMs: Date.now() - startedAt }
    } catch (error) {
        return toProbeError(error, startedAt)
    }
}

function shouldSampleConnectivityToSentry(): boolean {
    const day = new Date().toISOString().slice(0, 10)
    if (readStoredValue(CONNECTIVITY_SENTRY_DAY_KEY) === day) return false
    // Persist the daily decision, including a decision not to sample. Otherwise
    // repeated launches would turn 10% sampling into near-certain reporting.
    writeStoredValue(CONNECTIVITY_SENTRY_DAY_KEY, day)
    return Math.random() < CONNECTIVITY_SENTRY_SAMPLE_RATE
}

function utcDay(date: Date = new Date()): string {
    return date.toISOString().slice(0, 10)
}

function isPendingCanaryEvent(value: unknown): value is PendingCanaryEvent {
    if (!value || typeof value !== 'object') return false
    const event = value as Partial<PendingCanaryEvent>
    return (
        typeof event.id === 'string' &&
        typeof event.day === 'string' &&
        typeof event.capturedAt === 'string' &&
        !!event.properties &&
        typeof event.properties === 'object'
    )
}

function readConnectivityOutbox(): PendingCanaryEvent[] {
    const stored = readStoredValue(CONNECTIVITY_OUTBOX_KEY)
    if (!stored) return []
    try {
        const parsed: unknown = JSON.parse(stored)
        return Array.isArray(parsed) ? parsed.filter(isPendingCanaryEvent) : []
    } catch {
        return []
    }
}

function writeConnectivityOutbox(events: PendingCanaryEvent[]): void {
    if (events.length === 0) {
        removeStoredValue(CONNECTIVITY_OUTBOX_KEY)
        return
    }
    writeStoredValue(CONNECTIVITY_OUTBOX_KEY, JSON.stringify(events))
}

function freshConnectivityEvents(events: PendingCanaryEvent[], now: Date = new Date()): PendingCanaryEvent[] {
    const oldest = new Date(now)
    oldest.setUTCDate(oldest.getUTCDate() - CONNECTIVITY_OUTBOX_RETENTION_DAYS)
    return events.filter(({ capturedAt }) => {
        const timestamp = Date.parse(capturedAt)
        return Number.isFinite(timestamp) && timestamp >= oldest.getTime()
    })
}

function eventId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function persistConnectivityEvent(properties: CanaryEventProperties, now: Date = new Date()): PendingCanaryEvent {
    const day = utcDay(now)
    const events = freshConnectivityEvents(readConnectivityOutbox(), now)
    const existing = events.find((event) => event.day === day)
    if (existing) {
        writeConnectivityOutbox(events)
        return existing
    }

    const pending = { id: eventId(), day, capturedAt: now.toISOString(), properties }
    writeConnectivityOutbox([...events, pending])
    return pending
}

function capturePostHog(properties: CanaryEventProperties, pending?: PendingCanaryEvent, replayed = false) {
    if (!pending) return posthog.capture(CANARY_EVENT_NAME, properties)

    const durableProperties = {
        ...pending.properties,
        $insert_id: pending.id,
        canary_replayed: replayed,
        canary_original_captured_at: pending.capturedAt,
    }
    return replayed
        ? posthog.capture(CANARY_EVENT_NAME, durableProperties, {
              send_instantly: true,
              timestamp: new Date(pending.capturedAt),
          })
        : posthog.capture(CANARY_EVENT_NAME, durableProperties)
}

function flushConnectivityOutbox(): void {
    if (!navigator.onLine) return

    const now = new Date()
    const day = utcDay(now)
    const events = freshConnectivityEvents(readConnectivityOutbox(), now)
    for (const event of events) {
        if (event.lastReplayDay === day) continue
        try {
            // A stable $insert_id makes retries idempotent at ingestion. Keep the
            // compact event for the retention window because capture() confirms
            // SDK acceptance, not network delivery; retry it at most once/day.
            if (capturePostHog(event.properties, event, true)) event.lastReplayDay = day
        } catch {
            // Leave it pending for the next online launch.
        }
    }
    writeConnectivityOutbox(events)
}

export async function runCanary(): Promise<void> {
    // PostHog's retry queue is memory-only. Replay any durable connectivity
    // signal before the healthy fast path returns, so offline -> kill -> online
    // relaunch still produces an analytics event.
    flushConnectivityOutbox()

    const probes = [
        { name: 'get', transport: 'webview', run: () => probe('/healthz', { method: 'GET' }) },
        {
            name: 'post',
            transport: 'webview',
            // A string body defaults to the CORS-safelisted text/plain content
            // type. Setting application/json would add an OPTIONS preflight and
            // make this compare GET with "preflight + POST", a different test.
            run: () => probe('/healthz', { method: 'POST', body: '{}' }),
        },
        {
            name: 'native',
            transport: 'cap-native-http',
            run: () => nativeProbe(`${PEANUT_API_URL}/healthz`),
        },
    ]

    // Parallel so a dead network costs one CANARY_TIMEOUT_MS, not three.
    const results = await Promise.all(probes.map(({ run }) => run()))
    if (!results.some(isFailure)) return

    const outcomes = Object.fromEntries(probes.map(({ name }, i) => [name, results[i].outcome]))
    const signature = probes.map(({ name }, i) => `${name}:${isFailure(results[i]) ? 'fail' : 'ok'}`).join(' ')
    const allPrimaryFailed = results.every(isFailure)
    // Native HTTP avoids WebView CORS/no-cors differences, including iOS's lack
    // of opaque responses. Two independent hosts avoid classifying one blocked
    // control provider as a dead device. Only pay for them after every API
    // transport failed.
    const [capgo, internet] = allPrimaryFailed
        ? await Promise.all([nativeProbe(CAPGO_CONTROL_URL), nativeProbe(INTERNET_CONTROL_URL)])
        : [null, null]
    const classification: CanaryClassification = allPrimaryFailed
        ? (capgo && !isFailure(capgo)) || (internet && !isFailure(internet))
            ? 'api-unreachable'
            : 'device-connectivity'
        : 'transport-asymmetry'

    // CapacitorWebFetch is assigned unconditionally by the native bridge; only
    // an actual patch of window.fetch means the CapacitorHttp proxy is active.
    const capWebFetch = (window as unknown as { CapacitorWebFetch?: typeof fetch }).CapacitorWebFetch
    const baseFetch = getUnderlyingFetch() ?? window.fetch
    const webviewTransport = !!capWebFetch && baseFetch !== capWebFetch ? 'cap-http-proxy' : 'direct'
    const { appVersion, appBuild } = (await getBinaryInfo()) ?? { appVersion: 'unknown', appBuild: 'unknown' }
    const sentrySampled = classification !== 'device-connectivity' || shouldSampleConnectivityToSentry()

    const eventProperties: CanaryEventProperties = {
        canary_version: '6',
        canary_signature: signature,
        canary_classification: classification,
        canary_get: outcomes.get,
        canary_post: outcomes.post,
        canary_native: outcomes.native,
        canary_capgo: capgo?.outcome,
        canary_internet: internet?.outcome,
        canary_get_ms: results[0].durationMs,
        canary_post_ms: results[1].durationMs,
        canary_native_ms: results[2].durationMs,
        canary_capgo_ms: capgo?.durationMs,
        canary_internet_ms: internet?.durationMs,
        webview_transport: webviewTransport,
        app_version: appVersion,
        app_build: appBuild,
        online: navigator.onLine,
        sentry_sampled: sentrySampled,
    }

    try {
        const pending = classification === 'device-connectivity' ? persistConnectivityEvent(eventProperties) : undefined
        // flushConnectivityOutbox already replayed this device-day on this
        // launch. Do not enqueue the same stable $insert_id a second time.
        if (!pending || pending.lastReplayDay !== utcDay()) capturePostHog(eventProperties, pending)
    } catch {
        // Diagnostics must never affect app startup or the Sentry signal.
    }

    if (!sentrySampled) return

    Sentry.captureMessage(`native canary: ${signature}`, {
        level: classification === 'device-connectivity' ? 'info' : 'warning',
        fingerprint: ['native-canary-v6', classification, signature, webviewTransport],
        tags: {
            canary: 'transport',
            canaryVersion: '6',
            canary_signature: signature,
            canary_classification: classification,
            canary_get: outcomes.get,
            canary_post: outcomes.post,
            canary_native: outcomes.native,
            canary_capgo: capgo?.outcome ?? 'not-run',
            canary_internet: internet?.outcome ?? 'not-run',
            webviewTransport,
            appVersion,
            appBuild,
            online: String(navigator.onLine),
        },
        extra: {
            ...Object.fromEntries(
                probes.map(({ name }, i) => [
                    name,
                    {
                        durationMs: results[i].durationMs,
                        errorName: results[i].errorName,
                        errorMessage: results[i].errorMessage,
                    },
                ])
            ),
            ...(capgo ? { capgo } : {}),
            ...(internet ? { internet } : {}),
        },
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
