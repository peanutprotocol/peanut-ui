// These are the current renderer canary outputs, not an authorization list.
// Production release authorization comes only from SPLIT_CONTENT_RELEASE_DOCUMENT.
export const SPLIT_CANARY_GUIDE_PATHS = [
    '/en/split/guides/split-a-group-trip-across-countries',
    '/en/split/guides/split-expenses-across-currencies',
    '/es-419/split/guides/split-a-group-trip-across-countries',
    '/es-419/split/guides/split-expenses-across-currencies',
    '/pt-br/split/guides/split-a-group-trip-across-countries',
    '/pt-br/split/guides/split-expenses-across-currencies',
] as const
export const SPLIT_ENGLISH_CANARY_PATH = SPLIT_CANARY_GUIDE_PATHS[0]

export const SPLIT_ASSET_PREFIX = '/split-static'
export const SPLIT_SITEMAP_PATH = '/split-sitemap.xml'
export const SPLIT_CONTENT_RELEASE_DOCUMENT_ENV = 'SPLIT_CONTENT_RELEASE_DOCUMENT'
export const SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION = 1
export const SPLIT_EDGE_MARKER_HEADER = 'x-peanut-split-edge-marker'
export const SPLIT_MANIFEST_SHA256_HEADER = 'x-peanut-split-manifest-sha256'
export const SPLIT_INDEX_RELEASE_HEADER = 'x-peanut-split-index-released'
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
    | { state: 'ready'; marker: string; origin: URL; release: SplitContentRelease | null }

export interface SplitContentRelease {
    stage: 0 | 1 | 2 | 3
    manifestSchemaVersion: 1 | 2 | 3
    manifestSha256s: readonly string[]
    manifestPublicPaths: ReadonlySet<string>
    publicPaths: ReadonlySet<string>
    indexReleased: boolean
}

type SplitContentReleaseDocument = {
    version: typeof SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION
    stage: SplitContentRelease['stage']
    index: boolean
    manifest: {
        schema_version: SplitContentRelease['manifestSchemaVersion']
        sha256s: string[]
        public_paths: string[]
    }
    released_paths: string[]
}

const MAXIMUM_PERCENT_DECODE_PASSES = 8
const MINIMUM_MARKER_BYTES = 32
const MAXIMUM_RELEASE_DOCUMENT_BYTES = 32 * 1024
const MAXIMUM_RELEASE_PATHS = 512
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/
const PERCENT_ESCAPE = /%[0-9a-f]{2}/i
const MANIFEST_SHA256 = /^(?!0{64}$)[0-9a-f]{64}$/
const PUBLIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PUBLIC_LOCALES = new Set(['en', 'es-419', 'pt-br'])

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

export function isSupportedSplitContentPublicPath(pathname: string): boolean {
    const segments = pathname.split('/')
    const locale = segments[1]
    if (segments[0] !== '' || !PUBLIC_LOCALES.has(locale) || segments[2] !== 'split') return false

    const tail = segments.slice(3)
    if (tail.length === 0) return true
    if (tail[0] === 'tools') {
        return locale === 'en' && (tail.length === 1 || (tail.length === 2 && PUBLIC_SLUG.test(tail[1])))
    }
    return tail.length === 2 && (tail[0] === 'guides' || tail[0] === 'alternatives') && PUBLIC_SLUG.test(tail[1])
}

function classifyCanonicalSplitContentRequest(
    pathname: string,
    rscHeader: string | null,
    releasedPaths: ReadonlySet<string>
): SplitContentRoute {
    if (isSupportedSplitContentPublicPath(pathname)) {
        if (!releasedPaths.has(pathname)) return { action: 'not-found' }
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

export function classifySplitContentRequest(
    pathname: string,
    rscHeader: string | null,
    releasedPaths: ReadonlySet<string> = new Set()
): SplitContentRoute {
    const direct = classifyCanonicalSplitContentRequest(pathname, rscHeader, releasedPaths)
    if (direct.action !== 'pass') return direct
    if (!PERCENT_ESCAPE.test(pathname)) return direct

    const decoded = fullyDecodePathname(pathname)
    if (decoded === null) return { action: 'not-found' }

    const normalized = normalizeDecodedPathname(decoded)
    if (normalized === null) return { action: 'not-found' }

    // Encoded aliases of an owned or blocked Split path are never forwarded.
    // Only the literal released public path/assets/sitemap are canonical at the edge.
    for (const candidate of new Set([decoded, normalized])) {
        if (classifyCanonicalSplitContentRequest(candidate, rscHeader, releasedPaths).action !== 'pass') {
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

function samePaths(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((path, index) => path === right[index])
}

function parseCanonicalPublicPaths(value: unknown, allowEmpty: boolean): string[] | null {
    if (!Array.isArray(value) || value.length > MAXIMUM_RELEASE_PATHS || (!allowEmpty && value.length === 0)) {
        return null
    }

    const paths: string[] = []
    for (const path of value) {
        if (typeof path !== 'string' || !isSupportedSplitContentPublicPath(path)) return null
        if (paths.length > 0 && paths[paths.length - 1] >= path) return null
        paths.push(path)
    }
    return paths
}

export function resolveSplitContentRelease(
    value: string | undefined
): { state: 'closed' } | { state: 'invalid' } | { state: 'ready'; release: SplitContentRelease } {
    if (value === undefined || value === '') return { state: 'closed' }
    if (new TextEncoder().encode(value).byteLength > MAXIMUM_RELEASE_DOCUMENT_BYTES) return { state: 'invalid' }

    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    } catch {
        return { state: 'invalid' }
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { state: 'invalid' }

    const candidate = parsed as Partial<SplitContentReleaseDocument>
    const manifest = candidate.manifest as Partial<SplitContentReleaseDocument['manifest']> | undefined
    if (
        candidate.version !== SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION ||
        ![0, 1, 2, 3].includes(candidate.stage as number) ||
        typeof candidate.index !== 'boolean' ||
        typeof manifest !== 'object' ||
        manifest === null ||
        ![1, 2, 3].includes(manifest.schema_version as number) ||
        !Array.isArray(manifest.sha256s) ||
        manifest.sha256s.length < 1 ||
        manifest.sha256s.length > 2 ||
        manifest.sha256s.some((digest) => typeof digest !== 'string' || !MANIFEST_SHA256.test(digest)) ||
        manifest.sha256s.some((digest, index) => index > 0 && manifest.sha256s![index - 1] >= digest)
    ) {
        return { state: 'invalid' }
    }

    const manifestPaths = parseCanonicalPublicPaths(manifest.public_paths, false)
    const releasedPaths = parseCanonicalPublicPaths(candidate.released_paths, true)
    if (!manifestPaths || !releasedPaths) return { state: 'invalid' }

    const manifestPathSet = new Set(manifestPaths)
    if (releasedPaths.some((path) => !manifestPathSet.has(path))) return { state: 'invalid' }
    if (manifest.schema_version === 1 && manifestPaths.some((path) => !path.includes('/split/guides/'))) {
        return { state: 'invalid' }
    }

    const stage = candidate.stage as SplitContentRelease['stage']
    const schemaVersion = manifest.schema_version as SplitContentRelease['manifestSchemaVersion']
    if (stage === 0 && (releasedPaths.length !== 0 || candidate.index)) return { state: 'invalid' }
    if (stage === 1 && (!samePaths(releasedPaths, [SPLIT_ENGLISH_CANARY_PATH]) || candidate.index)) {
        return { state: 'invalid' }
    }
    if (stage === 2 && !samePaths(releasedPaths, SPLIT_CANARY_GUIDE_PATHS)) return { state: 'invalid' }
    if (stage === 3 && (schemaVersion < 2 || !samePaths(releasedPaths, manifestPaths))) {
        return { state: 'invalid' }
    }
    if (candidate.index && (stage < 2 || !samePaths(releasedPaths, manifestPaths))) {
        return { state: 'invalid' }
    }

    const canonical: SplitContentReleaseDocument = {
        version: SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION,
        stage,
        index: candidate.index,
        manifest: {
            schema_version: schemaVersion,
            sha256s: manifest.sha256s,
            public_paths: manifestPaths,
        },
        released_paths: releasedPaths,
    }
    // Byte-canonical JSON rejects duplicate/unknown keys, alternate key order,
    // whitespace, and coercion before any value reaches routing.
    if (JSON.stringify(canonical) !== value) return { state: 'invalid' }

    return {
        state: 'ready',
        release: {
            stage,
            manifestSchemaVersion: schemaVersion,
            manifestSha256s: manifest.sha256s,
            manifestPublicPaths: manifestPathSet,
            publicPaths: new Set(releasedPaths),
            indexReleased: candidate.index,
        },
    }
}

export function splitContentIndexReleased(value: string | undefined): boolean {
    const resolved = resolveSplitContentRelease(value)
    return resolved.state === 'ready' && resolved.release.indexReleased
}

export function resolveSplitContentEdgeConfig(
    originValue: string | undefined,
    markerValue: string | undefined,
    releaseValue: string | undefined = undefined
): SplitContentEdgeConfig {
    if (!originValue && !markerValue && !releaseValue) return { state: 'disabled' }
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

    const release = resolveSplitContentRelease(releaseValue)
    if (release.state === 'invalid') return { state: 'invalid' }

    return {
        state: 'ready',
        marker: markerValue,
        origin,
        release: release.state === 'ready' ? release.release : null,
    }
}

/**
 * Build a fresh, deliberately small header set for the renderer. Credentials,
 * caller-supplied forwarding state, Vercel bypasses, and a spoofed marker are
 * excluded by construction while HTML negotiation and Next Flight survive.
 */
export function splitContentForwardHeaders(
    requestHeaders: Headers,
    publicHost: string,
    marker: string,
    release: SplitContentRelease
): Headers {
    const forwarded = new Headers()
    for (const [name, value] of requestHeaders) {
        if (FORWARDED_REQUEST_HEADERS.has(name.toLowerCase())) forwarded.append(name, value)
    }
    forwarded.set('x-forwarded-host', publicHost)
    forwarded.set(SPLIT_EDGE_MARKER_HEADER, marker)
    forwarded.set(SPLIT_MANIFEST_SHA256_HEADER, release.manifestSha256s.join(','))
    forwarded.set(SPLIT_INDEX_RELEASE_HEADER, release.indexReleased ? '1' : '0')
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
