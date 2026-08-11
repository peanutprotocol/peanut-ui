export const SPLIT_A2_FIXTURE_PATH = '/en/split/a2-transport'
export const SPLIT_A2_HEADERS_PROOF_PATH = '/_split-a2/headers'
export const SPLIT_A2_SET_COOKIE_PROOF_PATH = '/_split-a2/set-cookie'
export const SPLIT_ASSET_PREFIX = '/split-static'
export const SPLIT_SITEMAP_PATH = '/split-sitemap.xml'
export const SPLIT_EDGE_MARKER_HEADER = 'x-peanut-split-edge-marker'

export type SplitA2RequestKind = 'html' | 'rsc' | 'asset' | 'sitemap' | 'headers-proof' | 'set-cookie-proof'

export type SplitA2Route =
    | { action: 'forward'; kind: SplitA2RequestKind }
    | { action: 'not-found' }
    | { action: 'pass' }

function isSplitPageNamespace(pathname: string): boolean {
    if (pathname === '/split' || pathname.startsWith('/split/')) return true

    const segments = pathname.split('/')
    return segments[0] === '' && Boolean(segments[1]) && segments[2] === 'split'
}

export function classifySplitA2Request(pathname: string, rscHeader: string | null): SplitA2Route {
    if (pathname === SPLIT_A2_HEADERS_PROOF_PATH) {
        return { action: 'forward', kind: 'headers-proof' }
    }

    if (pathname === SPLIT_A2_SET_COOKIE_PROOF_PATH) {
        return { action: 'forward', kind: 'set-cookie-proof' }
    }

    if (pathname === SPLIT_A2_FIXTURE_PATH) {
        return { action: 'forward', kind: rscHeader === '1' ? 'rsc' : 'html' }
    }

    if (pathname.startsWith(`${SPLIT_ASSET_PREFIX}/`)) {
        return { action: 'forward', kind: 'asset' }
    }

    if (pathname === SPLIT_SITEMAP_PATH) {
        return { action: 'forward', kind: 'sitemap' }
    }

    if (
        pathname === SPLIT_ASSET_PREFIX ||
        pathname.startsWith(`${SPLIT_SITEMAP_PATH}/`) ||
        isSplitPageNamespace(pathname)
    ) {
        return { action: 'not-found' }
    }

    return { action: 'pass' }
}

export function isSplitContentPathname(pathname: string): boolean {
    return classifySplitA2Request(pathname, null).action !== 'pass'
}

export function isSplitA2CanaryEnabled(enabled: string | undefined, vercelEnv: string | undefined): boolean {
    return enabled === '1' && vercelEnv !== 'production'
}

export function splitContentOrigin(value: string | undefined): URL | null {
    if (!value) return null

    try {
        const url = new URL(value)
        const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        if (
            (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) ||
            url.username ||
            url.password ||
            url.pathname !== '/' ||
            url.search ||
            url.hash
        ) {
            return null
        }
        return url
    } catch {
        return null
    }
}
