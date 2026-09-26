/** Access-protected read-only endpoint. Never exposes arbitrary bucket objects. */
function safeGalleryReturn(value, origin) {
    if (
        !value ||
        value.length > 2048 ||
        !value.startsWith('/') ||
        value.startsWith('//') ||
        /[\\\u0000-\u001f\u007f]/.test(value)
    )
        return null
    let target
    try {
        target = new URL(value, origin)
    } catch {
        return null
    }
    if (target.origin !== origin) return null
    const path = target.pathname
    if (
        path !== '/' &&
        path !== '/index.html' &&
        !/^\/screen-library(?:\/|\/index\.html)?$/.test(path) &&
        !/^\/screens(?:\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?)?$/.test(path) &&
        !/^\/collections\/[a-z0-9][a-z0-9-]{0,119}\/?$/.test(path)
    )
        return null
    return `${path}${target.search}${target.hash}`
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url)
        const path = url.pathname
        if (!['GET', 'HEAD'].includes(request.method))
            return new Response('Method not allowed', {
                status: 405,
                headers: { Allow: 'GET, HEAD' },
            })
        if (path === '/screen-data/auth/continue') {
            const destination = safeGalleryReturn(url.searchParams.get('return'), url.origin)
            if (!destination) return new Response('Invalid return path', { status: 400 })
            return new Response(null, {
                status: 302,
                headers: { Location: destination, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
            })
        }
        if (!path.startsWith('/screen-data/')) return new Response('Not found', { status: 404 })
        const key = path.slice('/screen-data/'.length)
        const reportManifest = /^reports\/[a-z0-9/-]+\/manifest\.json$/.test(key)
        const collectionManifest = /^collections\/[a-z0-9][a-z0-9-]{0,119}\/manifest\.json$/.test(key)
        const archive = /^reports\/[a-z0-9/-]+\/offline\.tar\.gz$/.test(key)
        const asset = /^assets\/[a-f0-9]{64}\.(png|webp)$/.test(key)
        if (
            !['index.json', 'latest.json'].includes(key) &&
            !reportManifest &&
            !collectionManifest &&
            !archive &&
            !asset
        )
            return new Response('Not found', { status: 404 })
        try {
            const object = request.method === 'HEAD' ? await env.REPORTS.head(key) : await env.REPORTS.get(key)
            if (!object) return new Response('Not found', { status: 404 })
            const headers = new Headers({
                'Content-Type': key.endsWith('.json')
                    ? 'application/json'
                    : key.endsWith('.png')
                      ? 'image/png'
                      : key.endsWith('.webp')
                        ? 'image/webp'
                        : 'application/gzip',
                'Cache-Control':
                    archive || asset
                        ? 'private, max-age=31536000, immutable'
                        : collectionManifest
                          ? 'private, max-age=10'
                          : 'private, max-age=60',
                'X-Content-Type-Options': 'nosniff',
                ETag: object.httpEtag,
            })
            if (key.endsWith('.tar.gz'))
                headers.set('Content-Disposition', 'attachment; filename="screen-library.tar.gz"')
            return new Response(request.method === 'HEAD' ? null : object.body, {
                headers,
            })
        } catch {
            return new Response('Report storage unavailable', {
                status: 503,
                headers: { 'Cache-Control': 'no-store' },
            })
        }
    },
}
