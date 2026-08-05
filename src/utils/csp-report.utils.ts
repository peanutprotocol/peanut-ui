/**
 * CSP violation report handling.
 *
 * Violation reports are POSTed by the browser straight to the policy's
 * `report-uri` / `report-to` endpoint. They never travel through the Sentry
 * browser SDK, so `beforeSend` / `shouldIgnoreError` in sentry.utils.ts cannot
 * see or drop them — which is why the noise filter lives here, behind the
 * /api/csp-report collector, instead of alongside the other Sentry filters.
 */

/**
 * Legacy `report-uri` payload (`application/csp-report`). Still what Firefox
 * and Safari send today. Kept as the canonical internal shape because it is
 * also the shape Sentry's security endpoint ingests.
 */
export interface CspReport {
    'blocked-uri'?: string
    'document-uri'?: string
    'effective-directive'?: string
    'violated-directive'?: string
    'source-file'?: string
    [key: string]: unknown
}

/** One entry of a Reporting-API (`report-to`) `application/reports+json` batch. */
interface ReportingApiEntry {
    type?: string
    body?: Record<string, unknown>
}

/**
 * Schemes that only ever appear because a browser extension (or the browser
 * itself) injected a script, style or request into our page. They are
 * inherently unfixable: an extension's origin is per-install, so no allow-list
 * entry can ever cover them, and nothing we ship causes them.
 *
 * Sentry's own security endpoint already drops most of this class server-side
 * (no `chrome-extension://` report has reached the project), so this is
 * defense-in-depth rather than the main lever — it keeps the guarantee ours
 * instead of depending on a Sentry project setting nobody remembers exists.
 * The bulk of the noise is repeated reports of one violation, which
 * cspReportGroupKey + the collector's de-duplication handle generically —
 * including injected hosts like Google Translate's fonts.gstatic.com that
 * arrive over plain https and no scheme check could catch.
 */
const EXTENSION_SCHEMES = [
    'chrome-extension:',
    'moz-extension:',
    'safari-extension:',
    'safari-web-extension:',
    'ms-browser-extension:',
    'webkit-masked-url:',
    'resource:', // Firefox internal pages/scripts
    'chrome:', // Chromium internal pages/scripts
    'about:', // about:blank / about:srcdoc injections
]

function isUnfixableOrigin(value: unknown): boolean {
    if (typeof value !== 'string') return false
    const lower = value.toLowerCase()
    return EXTENSION_SCHEMES.some((scheme) => lower.startsWith(scheme))
}

/**
 * True when a report is noise we can never act on. Deliberately narrow: the
 * keyword blocked-uris (`inline`, `eval`, `data`, `blob`) are NOT filtered —
 * those are genuine signal about how loose script-src still is, and they are
 * exactly what has to be driven to zero before the policy can be enforced.
 */
export function shouldIgnoreCspReport(report: CspReport): boolean {
    return isUnfixableOrigin(report['blocked-uri']) || isUnfixableOrigin(report['source-file'])
}

/** Reporting-API body (camelCase) → the legacy hyphenated shape. */
function fromReportingApi(body: Record<string, unknown>): CspReport {
    return {
        // blockedURL is the spec field; blockedURI is what some Chromium
        // versions still emit.
        'blocked-uri': (body.blockedURL ?? body.blockedURI) as string | undefined,
        'document-uri': body.documentURL as string | undefined,
        'effective-directive': body.effectiveDirective as string | undefined,
        // Sentry keys its CSP grouping off violated-directive; the Reporting
        // API dropped the field, so mirror the effective one.
        'violated-directive': body.effectiveDirective as string | undefined,
        'original-policy': body.originalPolicy,
        'source-file': body.sourceFile as string | undefined,
        'line-number': body.lineNumber,
        'column-number': body.columnNumber,
        'script-sample': body.sample,
        'status-code': body.statusCode,
        disposition: body.disposition,
        referrer: body.referrer,
    }
}

/**
 * Accept either wire format and return the reports in the legacy shape.
 * Unrecognised payloads yield an empty list rather than throwing — a malformed
 * report is never worth a 5xx back to the browser.
 */
export function normalizeCspReports(payload: unknown): CspReport[] {
    if (!payload || typeof payload !== 'object') return []

    // `report-to` — a batch of reports, only some of which are CSP violations.
    if (Array.isArray(payload)) {
        return (payload as ReportingApiEntry[])
            .filter((entry) => entry?.type === 'csp-violation' && entry.body && typeof entry.body === 'object')
            .map((entry) => fromReportingApi(entry.body as Record<string, unknown>))
    }

    // `report-uri` — a single report under the `csp-report` key.
    const legacy = (payload as Record<string, unknown>)['csp-report']
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) return [legacy as CspReport]

    return []
}

/**
 * Blocked-URIs that Sentry normalizes to "local" — the violation came from our
 * own document rather than a third-party origin. Chrome reports the keyword
 * (`inline` / `eval`) instead and is deliberately NOT in this list, matching
 * Sentry, which keys those on the keyword URI and raises a separate issue.
 */
const LOCAL_BLOCKED_URIS = ['', 'self', "'self'"]

/**
 * Grouping key used to decide whether a report is the first of its kind.
 * Mirrors how Sentry groups CSP issues (directive + blocked origin), so "first
 * of its kind here" means "would create a new Sentry issue".
 */
export function cspReportGroupKey(report: CspReport): string {
    // Take the first token, not the raw string. Firefox omits
    // `effective-directive` entirely and sends `violated-directive` as the FULL
    // directive text with its source list attached, so without this every
    // Firefox group key embeds the whole policy and churns on any policy edit.
    const directive = (report['effective-directive'] || report['violated-directive'] || 'unknown').split(' ')[0]
    const blocked = report['blocked-uri'] || 'unknown'

    // Sentry's csp:v1 strategy drops the blocked URI entirely and keys on the
    // keyword when a *local* script-src violation names 'unsafe-inline' /
    // 'unsafe-eval', so it raises TWO issues where a URI-based key sees one.
    // Mirror that: otherwise whichever of the pair arrives second looks like a
    // duplicate, gets sampled away, and its issue may never be created — and
    // those two are the top of this policy's "tighten before enforcing" list.
    //
    // The LOCAL_BLOCKED_URIS guard is load-bearing, not decoration. Our own
    // script-src literally contains 'unsafe-inline' and 'unsafe-eval', and
    // Firefox/Safari echo the entire source list back in violated-directive —
    // so without the guard EVERY script-src report matches a keyword,
    // including a genuinely blocked third-party script. That report would then
    // be grouped with the ubiquitous inline violation and sampled away at 1%,
    // which is precisely the issue-loss this de-duplication exists to prevent,
    // in the one directive that matters most for XSS. Match the quoted form
    // for the same reason Sentry does: an unquoted substring would also hit a
    // host in the source list.
    //
    // Matching the whole script-src family is deliberate: browsers report the
    // specific sub-directive they checked, so inline <script> violations
    // arrive as `script-src-elem` and inline handlers as `script-src-attr`
    // (only eval stays plain `script-src`). Keying more finely than Sentry is
    // always safe — it can only over-forward — whereas keying more coarsely is
    // what loses an issue.
    if ((directive === 'script-src' || directive.startsWith('script-src-')) && LOCAL_BLOCKED_URIS.includes(blocked)) {
        const violated = String(report['violated-directive'] ?? '')
        for (const keyword of ['unsafe-inline', 'unsafe-eval']) {
            if (violated.includes(`'${keyword}'`)) return `${directive}|${keyword}`
        }
    }

    // Only the origin matters for grouping; paths and query strings vary per
    // request and would otherwise make every single report look distinct.
    let origin = blocked
    try {
        origin = new URL(blocked).origin
    } catch {
        // Keyword blocked-uris (`inline`, `eval`, …) are not URLs — use as-is.
    }
    return `${directive}|${origin}`
}

/**
 * Sentry's CSP ingest endpoint, derived from the browser DSN
 * (`<protocol>://<publicKey>@<host><path>/<projectId>`). Returns null when the
 * DSN is absent or malformed, in which case reports are simply dropped.
 *
 * Protocol and any path prefix are preserved: self-hosted Sentry is commonly
 * mounted under a sub-path, and flattening one would silently post reports to
 * an endpoint that doesn't exist.
 */
export function sentryCspIngestUrl(dsn: string | undefined): string | null {
    if (!dsn) return null
    try {
        const { protocol, host, username, pathname } = new URL(dsn)
        const segments = pathname.split('/').filter(Boolean)
        const projectId = segments.pop()
        if (!host || !username || !projectId) return null
        const prefix = segments.length ? `/${segments.join('/')}` : ''
        return `${protocol}//${host}${prefix}/api/${projectId}/security/?sentry_key=${username}`
    } catch {
        return null
    }
}
