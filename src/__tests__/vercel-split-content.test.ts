/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SPLIT_CANARY_GUIDE_PATHS, SPLIT_RAW_ROUTE_HEADER, SPLIT_RAW_ROUTE_VALUE } from '@/utils/split-content-edge'

interface VercelTransform {
    type: 'request.headers' | 'response.headers' | 'request.query'
    op: 'append' | 'set' | 'delete'
    target: { key: string }
    args?: string | string[]
}

interface VercelTransformRoute {
    src: string
    caseSensitive?: boolean
    transforms: VercelTransform[]
    continue: boolean
}

describe('Vercel Split raw-route and response sanitation contract', () => {
    const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
    const transformRoutes = (vercelConfig.routes ?? []).filter(
        (route: Partial<VercelTransformRoute>) => route.transforms !== undefined
    ) as VercelTransformRoute[]
    const [callerHeaderScrubRoute, canonicalSplitRoute] = transformRoutes

    it('uses ordered, case-sensitive transforms from the official schema', () => {
        expect(vercelConfig.$schema).toBe('https://openapi.vercel.sh/vercel.json')
        expect(transformRoutes).toHaveLength(2)
        expect(callerHeaderScrubRoute).toEqual({
            src: '^/.*$',
            caseSensitive: true,
            transforms: [
                {
                    type: 'request.headers',
                    op: 'delete',
                    target: { key: SPLIT_RAW_ROUTE_HEADER },
                },
            ],
            continue: true,
        })
        expect(canonicalSplitRoute).toMatchObject({
            caseSensitive: true,
            continue: true,
            transforms: [
                {
                    type: 'request.headers',
                    op: 'append',
                    target: { key: SPLIT_RAW_ROUTE_HEADER },
                    args: SPLIT_RAW_ROUTE_VALUE,
                },
                {
                    type: 'response.headers',
                    op: 'delete',
                    target: { key: 'set-cookie' },
                },
            ],
        })
    })

    it.each([
        ...SPLIT_CANARY_GUIDE_PATHS,
        '/split-static/_next/static/chunks/app.js',
        '/split-static/fonts/peanut.woff2',
        '/split-sitemap.xml',
    ])('stamps and removes every upstream Set-Cookie on literal forwarded path %s', (pathname) => {
        expect(new RegExp(canonicalSplitRoute.src).test(pathname)).toBe(true)
        expect(applyRequestHeaderTransforms(pathname, { [SPLIT_RAW_ROUTE_HEADER]: 'caller-spoof' })).toEqual({
            [SPLIT_RAW_ROUTE_HEADER]: SPLIT_RAW_ROUTE_VALUE,
        })
    })

    it.each([
        '/split',
        '/en/split',
        '/en/split/guides/unknown',
        '/fr/split/guides/split-expenses-across-currencies',
        '/en/split/guides/split-expenses-across-currencies/extra',
        '/split-static',
        '/split-sitemap.xml/extra',
        '/en/%73plit/guides/unknown',
        '/en/split%2Fguides/unknown',
        '/en/%2Fsplit/guides/unknown',
        '/%2Fsplit-static/a.js',
        '/split%2Dstatic/a.js',
        '/split%2Dsitemap.xml',
        '/foo/%2e%2e/split-static/a.js',
        '/foo/%252e%252e/split-static/a.js',
        '/split-static/../home',
        '/split-static/./a.js',
        '/split-static/a/../home',
        '/split-static/a/%2e%2e/home',
        '/split-static/a%2Fb.js',
        '/split-static/a//b.js',
        '/split-static/a\\b.js',
        '/SPLIT-STATIC/a.js',
        '/home',
        '/splitter',
    ])('scrubs caller proof but does not stamp non-canonical raw path %s', (pathname) => {
        expect(new RegExp(canonicalSplitRoute.src).test(pathname)).toBe(false)
        expect(applyRequestHeaderTransforms(pathname, { [SPLIT_RAW_ROUTE_HEADER]: 'caller-spoof' })).toEqual({})
    })

    function applyRequestHeaderTransforms(pathname: string, initial: Record<string, string>): Record<string, string> {
        const headers = new Headers(initial)

        for (const route of transformRoutes) {
            if (!new RegExp(route.src, route.caseSensitive === false ? 'i' : undefined).test(pathname)) continue
            for (const transform of route.transforms) {
                if (transform.type !== 'request.headers') continue
                if (transform.op === 'delete') headers.delete(transform.target.key)
                if (transform.op === 'append') {
                    for (const value of Array.isArray(transform.args) ? transform.args : [transform.args ?? '']) {
                        headers.append(transform.target.key, value)
                    }
                }
                if (transform.op === 'set' && !headers.has(transform.target.key)) {
                    headers.set(
                        transform.target.key,
                        Array.isArray(transform.args) ? transform.args.join(', ') : (transform.args ?? '')
                    )
                }
            }
        }

        return Object.fromEntries(headers)
    }
})
