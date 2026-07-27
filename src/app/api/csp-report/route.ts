import { NextRequest, NextResponse } from 'next/server'

import {
    cspReportGroupKey,
    normalizeCspReports,
    sentryCspIngestUrl,
    shouldIgnoreCspReport,
} from '@/utils/csp-report.utils'

export const dynamic = 'force-dynamic'

/**
 * Collector for the report-only CSP's violation reports.
 *
 * The policy used to point `report-uri` / `report-to` straight at Sentry's
 * security endpoint, which put ~65k events across ~1.3k users into the
 * peanut-ui project in four days and buried real signal. Those reports bypass
 * the Sentry browser SDK entirely, so no `beforeSend` filter could touch them —
 * the only place to filter is an endpoint we own.
 *
 * This forwards to Sentry exactly as before, minus two classes of pure noise:
 * repeats of a violation Sentry has already grouped (the dominant class — one
 * missing allow-list entry produced 14k events on its own) and reports injected
 * by browser extensions.
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
        if (seenGroups.size >= SEEN_GROUPS_MAX) seenGroups.clear()
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

        const forwardable = reports
            .filter((report) => !shouldIgnoreCspReport(report))
            .filter((report) => shouldForward(cspReportGroupKey(report)))

        await Promise.allSettled(
            forwardable.map((report) =>
                fetch(ingestUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/csp-report' },
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
