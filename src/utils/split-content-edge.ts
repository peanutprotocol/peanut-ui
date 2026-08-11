export const SPLIT_CANARY_LOCALES = ['en', 'es-419', 'pt-br'] as const
export const SPLIT_CANARY_GUIDE_SLUGS = [
    'split-a-group-trip-across-countries',
    'split-expenses-across-currencies',
] as const

// Source of truth: mono/split-content/_system/generated/manifest.json.
// B2 deliberately forwards only the six A1 canary outputs, not the namespace.
export const SPLIT_CANARY_GUIDE_PATHS = SPLIT_CANARY_GUIDE_SLUGS.flatMap((slug) =>
    SPLIT_CANARY_LOCALES.map((locale) => `/${locale}/split/guides/${slug}`)
)

export const SPLIT_ASSET_PREFIX = '/split-static'
export const SPLIT_SITEMAP_PATH = '/split-sitemap.xml'
export const SPLIT_EDGE_MARKER_HEADER = 'x-peanut-split-edge-marker'
export const SPLIT_RAW_ROUTE_HEADER = 'x-peanut-split-raw-route'
export const SPLIT_RAW_ROUTE_VALUE = 'canonical-v1'
export const SPLIT_RAW_UNSAFE_HEADER = 'x-peanut-split-raw-unsafe'
export const SPLIT_RAW_UNSAFE_VALUE = 'unsafe-v1'

export type SplitContentRequestKind = 'html' | 'rsc' | 'asset' | 'sitemap'
export type SplitContentRoute =
    | { action: 'forward'; kind: SplitContentRequestKind }
    | { action: 'not-found' }
    | { action: 'pass' }

export type SplitContentEdgeConfig =
    | { state: 'disabled' }
    | { state: 'invalid' }
    | { state: 'ready'; marker: string; origin: URL }

const CANARY_GUIDE_PATHS = new Set<string>(SPLIT_CANARY_GUIDE_PATHS)
const MAXIMUM_PERCENT_DECODE_PASSES = 8
const MINIMUM_MARKER_BYTES = 32
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/
const PERCENT_ESCAPE = /%[0-9a-f]{2}/i

const FORWARDED_REQUEST_HEADERS = new Set([
    'accept',
    'accept-encoding',
    'accept-language',
    'cache-control',
    'if-modified-since',
    'if-none-match',
    'next-router-prefetch',
    'next-router-segment-prefetch',
    'next-router-state-tree',
    'next-url',
    'purpose',
    'range',
    'rsc',
    'sec-purpose',
    'user-agent',
    'x-nextjs-data',
    'x-nextjs-html-request-id',
    'x-nextjs-postponed',
])

function isSplitPageNamespace(pathname: string): boolean {
    const caseFolded = pathname.toLowerCase()
    if (caseFolded === '/split' || caseFolded.startsWith('/split/')) return true

    const segments = caseFolded.split('/')
    return segments[0] === '' && Boolean(segments[1]) && segments[2] === 'split'
}

function classifyCanonicalSplitContentRequest(pathname: string, rscHeader: string | null): SplitContentRoute {
    if (CANARY_GUIDE_PATHS.has(pathname)) {
        return { action: 'forward', kind: rscHeader === '1' ? 'rsc' : 'html' }
    }

    if (pathname.startsWith(`${SPLIT_ASSET_PREFIX}/`)) return { action: 'forward', kind: 'asset' }
    if (pathname === SPLIT_SITEMAP_PATH) return { action: 'forward', kind: 'sitemap' }

    const caseFolded = pathname.toLowerCase()
    if (
        caseFolded === SPLIT_ASSET_PREFIX ||
        caseFolded.startsWith(`${SPLIT_ASSET_PREFIX}/`) ||
        caseFolded === SPLIT_SITEMAP_PATH ||
        caseFolded.startsWith(`${SPLIT_SITEMAP_PATH}/`) ||
        isSplitPageNamespace(pathname)
    ) {
        return { action: 'not-found' }
    }

    return { action: 'pass' }
}

function fullyDecodePathname(pathname: string): string | null {
    let decoded = pathname

    // Bound edge CPU for hostile deeply nested encodings. Anything still
    // encoded after the supported depth fails closed instead of reaching a
    // product catch-all. A mixed valid/malformed encoding fails closed too.
    for (let pass = 0; pass < MAXIMUM_PERCENT_DECODE_PASSES; pass += 1) {
        if (!PERCENT_ESCAPE.test(decoded)) return decoded
        try {
            decoded = decodeURIComponent(decoded)
        } catch {
            return null
        }
    }

    return PERCENT_ESCAPE.test(decoded) ? null : decoded
}

function normalizeDecodedPathname(pathname: string): string | null {
    try {
        // Resolve encoded dot segments, backslashes, and encoded query/fragment
        // boundaries the same way a URL consumer would. Collapse separators
        // before dot-segment resolution as well, because Next canonicalizes raw
        // repeated slashes but does not do so after an encoded slash is decoded.
        // The decoded value is appended after a fixed host and cannot replace it.
        const canonicalSeparators = pathname.replaceAll('\\', '/').replace(/\/{2,}/g, '/')
        return new URL(`https://split-content.invalid${canonicalSeparators}`).pathname
    } catch {
        return null
    }
}

export function classifySplitContentRequest(pathname: string, rscHeader: string | null): SplitContentRoute {
    const direct = classifyCanonicalSplitContentRequest(pathname, rscHeader)
    if (direct.action !== 'pass') return direct
    if (!PERCENT_ESCAPE.test(pathname)) return direct

    const decoded = fullyDecodePathname(pathname)
    if (decoded === null) return { action: 'not-found' }

    const normalized = normalizeDecodedPathname(decoded)
    if (normalized === null) return { action: 'not-found' }

    // Encoded aliases of an owned or blocked Split path are never forwarded.
    // Only the literal A1 public paths/assets/sitemap are canonical at the edge.
    for (const candidate of new Set([decoded, normalized])) {
        if (classifyCanonicalSplitContentRequest(candidate, rscHeader).action !== 'pass') {
            return { action: 'not-found' }
        }
    }

    return direct
}

export function isSplitContentPathname(pathname: string): boolean {
    return classifySplitContentRequest(pathname, null).action !== 'pass'
}

export function splitContentServiceWorkerMatcher({ url }: { url: URL }): boolean {
    return isSplitContentPathname(url.pathname)
}

export function resolveSplitContentEdgeConfig(
    originValue: string | undefined,
    markerValue: string | undefined
): SplitContentEdgeConfig {
    if (!originValue && !markerValue) return { state: 'disabled' }
    if (!originValue || !markerValue) return { state: 'invalid' }

    let origin: URL
    try {
        origin = new URL(originValue)
    } catch {
        return { state: 'invalid' }
    }

    if (
        origin.protocol !== 'https:' ||
        origin.username ||
        origin.password ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash ||
        !PRINTABLE_ASCII.test(markerValue) ||
        new TextEncoder().encode(markerValue).byteLength < MINIMUM_MARKER_BYTES
    ) {
        return { state: 'invalid' }
    }

    return { state: 'ready', marker: markerValue, origin }
}

/**
 * Build a fresh, deliberately small header set for the renderer. Credentials,
 * caller-supplied forwarding state, Vercel bypasses, and a spoofed marker are
 * excluded by construction while HTML negotiation and Next Flight survive.
 */
export function splitContentForwardHeaders(requestHeaders: Headers, publicHost: string, marker: string): Headers {
    const forwarded = new Headers()
    for (const [name, value] of requestHeaders) {
        if (FORWARDED_REQUEST_HEADERS.has(name.toLowerCase())) forwarded.append(name, value)
    }
    forwarded.set('x-forwarded-host', publicHost)
    forwarded.set(SPLIT_EDGE_MARKER_HEADER, marker)
    return forwarded
}

/**
 * Vercel stamps literal public paths before Next parses and normalizes them.
 * `vercel.json` first deletes this header from every incoming request, so the
 * value is platform provenance rather than a caller assertion.
 */
export function hasTrustedSplitRawRouteStamp(requestHeaders: Headers): boolean {
    return requestHeaders.get(SPLIT_RAW_ROUTE_HEADER) === SPLIT_RAW_ROUTE_VALUE
}

/**
 * Vercel stamps structural raw-path hazards before Next normalizes them. This
 * bit must be checked before classifying `nextUrl.pathname`: by then a request
 * such as /split-static/%2e%2e/home is indistinguishable from literal /home.
 */
export function hasUnsafeSplitRawRouteStamp(requestHeaders: Headers): boolean {
    return requestHeaders.get(SPLIT_RAW_UNSAFE_HEADER) === SPLIT_RAW_UNSAFE_VALUE
}
