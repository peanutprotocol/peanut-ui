import { NextRequest, NextResponse } from 'next/server'

import {
    cspReportGroupKey,
    normalizeCspReports,
    sentryCspIngestUrl,
    shouldIgnoreCspReport,
    type CspReport,
} from '@/utils/csp-report.utils'

export const dynamic = 'force-dynamic'

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

/**
 * Hard cap on forwards per request. This endpoint is unauthenticated and a
 * Reporting-API batch is an array, so without a cap one POST could fan out
 * arbitrarily many events. That matters more than it looks: Sentry bills CSP
 * reports against the *error* quota under a per-DSN-key rate limit, so an
 * uncapped fan-out could exhaust the quota that real application exceptions
 * depend on. A genuine browser batch is a handful of reports.
 */
const MAX_FORWARDS_PER_REQUEST = 20

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

        const seenInBatch = new Set<string>()
        const forwardable: CspReport[] = []
        for (const report of reports) {
            if (shouldIgnoreCspReport(report)) continue

            const groupKey = cspReportGroupKey(report)
            // One slot per distinct group: a batch is usually dominated by
            // repeats of a single violation, and 20 copies of it must not
            // crowd a genuinely new group out of the per-request cap.
            if (seenInBatch.has(groupKey)) continue
            seenInBatch.add(groupKey)

            // Cap BEFORE shouldForward, never after: shouldForward records
            // each group as seen, so admitting more than we can send would
            // mark groups seen that were never actually sent — their real
            // first sighting lost, every later repeat sampled away.
            if (seenInBatch.size > MAX_FORWARDS_PER_REQUEST) break

            if (shouldForward(groupKey)) forwardable.push(report)
        }

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
