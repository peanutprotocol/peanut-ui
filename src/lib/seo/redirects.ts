import redirects from '../../../redirects.json'

// Exact, unconditional permanent redirects are retired URLs, even while their
// source files remain in the content mirror during a staged publication.
const permanentRedirects = new Map(
    redirects
        .filter(
            (redirect) =>
                redirect.permanent && !redirect.source.includes(':') && !('has' in redirect) && !('missing' in redirect)
        )
        .map((redirect) => [redirect.source, redirect.destination])
)

export function isPermanentRedirectPath(pathname: string): boolean {
    return permanentRedirects.has(pathname)
}

export function resolvePermanentRedirectPath(pathname: string): string {
    return permanentRedirects.get(pathname) ?? pathname
}
