import { captureException } from '@sentry/nextjs'
import posthog from 'posthog-js'
import { PEANUT_API_URL } from '@/constants/general.consts'

/*
 * `TypeError: Failed to fetch` proves nothing about the user's connection: a
 * WAF challenge on the API hostname, a CORS-less edge error page (Cloudflare
 * 5xx), a blocked preflight and a dead radio all surface identically, with no
 * status to look at (TASK-21956 — the reported device was online and the PWA
 * worked). A no-cors probe separates them: it resolves with an opaque response
 * whenever the network transaction completes — ANY status, no ACAO header
 * required, no preflight — so it answers "did the edge answer at all" where a
 * normal fetch cannot.
 */

// Engine-exact rejection copy; also matched by the connectionLost classifier
// in friendly-error.utils.tsx, which imports this predicate to stay in sync.
export const NATIVE_FETCH_REJECTION_MESSAGES: readonly string[] = [
    'Failed to fetch', // Chromium, so every Android WebView
    'Load failed', // WebKit
    'NetworkError when attempting to fetch resource.', // Gecko
]

export function isNativeFetchRejection(name: string | undefined, message: string | undefined): boolean {
    return name === 'TypeError' && message !== undefined && NATIVE_FETCH_REJECTION_MESSAGES.includes(message)
}

type NetworkErrorClass = 'fetch_rejection' | 'timeout' | 'service_unavailable'

// fetchWithSentry rethrows its network-layer failures under these names, so a
// flow-level catch only sees the raw TypeError for calls that bypassed it.
function classifyNetworkFailure(error: unknown): NetworkErrorClass | null {
    if (!(error instanceof Error)) return null
    if (isNativeFetchRejection(error.name, error.message)) return 'fetch_rejection'
    if (error.name === 'ConnectionTimeoutError') return 'timeout'
    if (error.name === 'ServiceUnavailableError') return 'service_unavailable'
    return null
}

export interface NetworkTriage {
    /**
     * What the probes OBSERVED in the seconds after the failure — not proof of
     * what caused it: a transient radio drop can recover inside that gap and
     * still read `api_reachable`. Per event this is a hint; the causal signal
     * is the distribution (a population of `api_reachable` + `net_online:true`
     * failures is not a connectivity story). Read alongside `errorClass` — for
     * a `timeout`, `api_reachable` means "edge up, endpoint slow", saying
     * nothing about CORS.
     * - `api_reachable`: the edge answered the probe after the request failed
     * - `edge_unreachable`: the internet answered, our edge did not
     * - `offline`: nothing answered
     */
    observed: 'api_reachable' | 'edge_unreachable' | 'offline'
    errorClass: NetworkErrorClass
    online: boolean
    effectiveType?: string
    probeMs: number
}

const PROBE_TIMEOUT_MS = 2500

async function probe(url: string): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
        await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
        return true
    } catch {
        return false
    } finally {
        clearTimeout(timer)
    }
}

export async function triageNetworkFailure(error: unknown): Promise<NetworkTriage | null> {
    if (typeof navigator === 'undefined' || typeof fetch === 'undefined') return null
    const errorClass = classifyNetworkFailure(error)
    if (!errorClass) return null
    const online = navigator.onLine
    const started = Date.now()
    // gstatic's generate_204 is Android's own captive-portal check — the most
    // dependable "is the internet there at all" endpoint a WebView can reach.
    const [apiReachable, internetReachable] = await Promise.all([
        probe(`${PEANUT_API_URL}/healthz`),
        probe('https://www.gstatic.com/generate_204'),
    ])
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
    return {
        observed: apiReachable ? 'api_reachable' : internetReachable ? 'edge_unreachable' : 'offline',
        errorClass,
        online,
        effectiveType: connection?.effectiveType,
        probeMs: Date.now() - started,
    }
}

export function networkTriageTags(triage: NetworkTriage | null): Record<string, string> {
    if (!triage) return {}
    return {
        net_probe: triage.observed,
        net_error_class: triage.errorClass,
        net_online: String(triage.online),
        ...(triage.effectiveType ? { net_effective_type: triage.effectiveType } : {}),
    }
}

interface CaptureOptions {
    tags: Record<string, string>
    extra?: Record<string, unknown>
    analytics?: { event: string; props: Record<string, unknown> }
}

/**
 * Report a flow failure with the triage verdict riding on the SAME Sentry and
 * analytics events, so every occurrence self-labels instead of needing a
 * cross-referenced probe event. Awaiting the probes (bounded at 2.5s) is why
 * callers must fire-and-forget from their catch block AFTER setting UI error
 * state — nothing here may hold up the render or `finally` cleanup.
 */
export async function captureNetworkTriagedFailure(
    error: unknown,
    { tags, extra, analytics }: CaptureOptions
): Promise<void> {
    let triage: NetworkTriage | null = null
    try {
        triage = await triageNetworkFailure(error)
    } catch {
        // diagnostics must never mask the failure being reported
    }
    const triageTags = networkTriageTags(triage)
    // probeMs rides in extra/props, not tags — millisecond values would blow
    // up tag cardinality while still mattering for reading a single event
    // (how stale the observation is relative to the failure).
    const timing = triage ? { net_probe_ms: triage.probeMs } : {}
    if (analytics) {
        posthog.capture(analytics.event, { ...analytics.props, ...triageTags, ...timing })
    }
    captureException(error, { tags: { ...tags, ...triageTags }, extra: triage ? { ...extra, ...timing } : extra })
}
