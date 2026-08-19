import { NextRequest, NextResponse } from 'next/server'

import { normalizeCspReports, selectReportsToForward, sentryCspIngestUrl } from '@/utils/csp-report.utils'

export const dynamic = 'force-dynamic'

/**
 * One JSON parse plus at most MAX_FORWARDS_PER_REQUEST parallel fetches of
 * FORWARD_TIMEOUT_MS each — this can never legitimately need more than a few
 * seconds. Worth declaring on an unauthenticated route, because the fallback is
 * a project default measured in minutes (`vercel.json` says 300s, though its
 * `app/api/**` glob misses this project's `src/`-prefixed routes — see
 * SERVER_FETCH_TIMEOUT_MS in sentry.utils.ts).
 */
export const maxDuration = 10

/**
 * Collector for the report-only CSP's violation reports.
 *
 * The policy used to point `report-uri` / `report-to` straight at Sentry's
 * security endpoint, which put ~70k events across ~1.8k users into the
 * peanut-ui project in a week and buried real signal. Those reports bypass
 * the Sentry browser SDK entirely, so no `beforeSend` filter could touch them —
 * the only place to filter is an endpoint we own.
 *
 * This forwards to Sentry exactly as before, minus repeats of a violation
 * Sentry has already grouped — one missing allow-list entry produced 14k
 * identical events on its own, so de-duplication is the entire lever here. The
 * extension-scheme filter in csp-report.utils.ts is a cheap extra that saves an
 * outbound request; Sentry's own default inbound filter already drops that
 * class server-side, so it is not doing the real work.
 *
 * Unauthenticated by necessity — browsers POST violation reports with no
 * credentials. What that exposes is our invocation and egress cost, not Sentry
 * quota: `report-uri` used to point straight at Sentry and that URL embeds the
 * public DSN key shipped in every client bundle, so anyone could always POST
 * there directly, with or without this route. The control for the cost is a
 * Vercel WAF rate limit on this path (Firewall → Rate Limit, `/api/csp-report`,
 * ~100 requests / 60s per IP, action deny) — it runs before the function and
 * holds across instances, where an in-memory limiter would reset on every cold
 * start and miss any distributed source entirely. Until that rule exists,
 * `maxDuration` and MAX_FORWARDS_PER_REQUEST are what bound a single request.
 */

/** Both wire formats, plus plain JSON from anything replaying a report. */
const ACCEPTED_CONTENT_TYPES = ['application/csp-report', 'application/reports+json', 'application/json']

/**
 * Sentry groups CSP issues by directive + blocked origin, so every duplicate
 * past the first adds quota, not information. Forward the first sighting of
 * each group unconditionally — a genuinely new violation always creates its
 * issue and fires its alert — then sample the repeats hard.
 *
 * The Set is per-serverless-instance and resets on cold start, which just means
 * an occasional extra first-sighting. Same trade-off the health route's
 * in-memory Discord cooldown already accepts.
 */
const DUPLICATE_SAMPLE_RATE = 0.01
const SEEN_GROUPS_MAX = 500
const seenGroups = new Set<string>()

const FORWARD_TIMEOUT_MS = 3000

function shouldForward(groupKey: string): boolean {
    if (!seenGroups.has(groupKey)) {
        // Bound the memory: a flood of distinct groups must not grow forever.
        // Evict the oldest rather than clearing — a Set iterates in insertion
        // order, so this drops one stale group instead of dumping all 500 and
        // letting every still-active violation re-forward at once.
        if (seenGroups.size >= SEEN_GROUPS_MAX) {
            const oldest = seenGroups.values().next().value
            if (oldest !== undefined) seenGroups.delete(oldest)
        }
        seenGroups.add(groupKey)
        return true
    }
    return Math.random() < DUPLICATE_SAMPLE_RATE
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    // Always 204, whatever happens. A non-2xx here makes browsers retry and
    // log console errors, which would be a second, self-inflicted noise source.
    const noContent = new NextResponse(null, { status: 204 })

    try {
        const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
        if (!ACCEPTED_CONTENT_TYPES.includes(contentType)) return noContent

        const ingestUrl = sentryCspIngestUrl(process.env.NEXT_PUBLIC_SENTRY_DSN)
        if (!ingestUrl) return noContent

        const reports = normalizeCspReports(await request.json())
        const forwardable = selectReportsToForward(reports, shouldForward)

        // Sentry derives the event's browser and request context from the
        // headers of whoever POSTs to its security endpoint. That used to be
        // the browser itself; now it is us, so pass the originals through or
        // every CSP event is attributed to one Vercel egress IP running
        // undici — deleting the "which browser / how many users" dimension
        // these reports are read for.
        const forwardedHeaders: Record<string, string> = { 'Content-Type': 'application/csp-report' }
        const userAgent = request.headers.get('user-agent')
        if (userAgent) forwardedHeaders['User-Agent'] = userAgent
        const forwardedFor = request.headers.get('x-forwarded-for')
        if (forwardedFor) forwardedHeaders['X-Forwarded-For'] = forwardedFor

        await Promise.allSettled(
            forwardable.map((report) =>
                fetch(ingestUrl, {
                    method: 'POST',
                    headers: forwardedHeaders,
                    body: JSON.stringify({ 'csp-report': report }),
                    signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
                })
            )
        )
    } catch {
        // Malformed body, unreachable Sentry, timeout — a dropped violation
        // report is never worth surfacing an error to the browser.
    }

    return noContent
}
