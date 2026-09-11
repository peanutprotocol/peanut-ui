/** Public read-only report endpoint. Never exposes arbitrary bucket objects. */
export default {
    async fetch(request, env) {
        const path = new URL(request.url).pathname
        if (!['GET', 'HEAD'].includes(request.method))
            return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
        if (!path.startsWith('/screen-data/')) return new Response('Not found', { status: 404 })
        const key = path.slice('/screen-data/'.length)
        const report = /^reports\/[a-z0-9/-]+\/(manifest\.json|offline\.tar\.gz)$/.test(key)
        if (!['index.json', 'latest.json'].includes(key) && !report) return new Response('Not found', { status: 404 })
        try {
            const object = request.method === 'HEAD' ? await env.REPORTS.head(key) : await env.REPORTS.get(key)
            if (!object) return new Response('Not found', { status: 404 })
            const headers = new Headers({
                'Content-Type': key.endsWith('.json') ? 'application/json' : 'application/gzip',
                'Cache-Control': report ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
                'X-Content-Type-Options': 'nosniff',
                ETag: object.httpEtag,
            })
            if (key.endsWith('.tar.gz'))
                headers.set('Content-Disposition', 'attachment; filename="screen-library.tar.gz"')
            return new Response(request.method === 'HEAD' ? null : object.body, { headers })
        } catch {
            return new Response('Report storage unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
        }
    },
}
