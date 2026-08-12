/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
    SPLIT_CANARY_GUIDE_PATHS,
    SPLIT_CONTENT_RESERVED_PATH_PREFIXES,
    SPLIT_RAW_ROUTE_HEADER,
    SPLIT_RAW_ROUTE_VALUE,
    SPLIT_RAW_UNSAFE_HEADER,
    SPLIT_RAW_UNSAFE_VALUE,
} from '@/utils/split-content-edge'

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
    const [callerHeaderScrubRoute, unsafeRawRoute, canonicalSplitRoute] = transformRoutes

    it('uses ordered, case-sensitive transforms from the official schema', () => {
        expect(vercelConfig.$schema).toBe('https://openapi.vercel.sh/vercel.json')
        expect(transformRoutes).toHaveLength(3)
        expect(callerHeaderScrubRoute).toEqual({
            src: '^/.*$',
            caseSensitive: true,
            transforms: [
                {
                    type: 'request.headers',
                    op: 'delete',
                    target: { key: SPLIT_RAW_ROUTE_HEADER },
                },
                {
                    type: 'request.headers',
                    op: 'delete',
                    target: { key: SPLIT_RAW_UNSAFE_HEADER },
                },
            ],
            continue: true,
        })
        expect(unsafeRawRoute).toEqual({
            src: '^(?=/)(?=.*(?:\\\\|%(?:25)*5[cC]|(?:/|%(?:25)*2[fF])(?:\\.|%(?:25)*2[eE]){1,2}(?=/|\\\\|%(?:25)*(?:2[fF]|5[cC])|$))).*$',
            caseSensitive: true,
            transforms: [
                {
                    type: 'request.headers',
                    op: 'append',
                    target: { key: SPLIT_RAW_UNSAFE_HEADER },
                    args: SPLIT_RAW_UNSAFE_VALUE,
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
        '/en/split',
        '/es-419/split',
        '/pt-br/split',
        '/es/split',
        '/es-es/split',
        '/pt/split',
        '/sh/split',
        '/fr/split',
        '/de-de/split',
        '/zh-hans/split',
        '/zh-hans-cn/split',
        '/en/split/guides/future-guide',
        '/zh-hans-cn/split/guides/future-guide',
        '/pt-br/split/alternatives/splitwise',
        '/en/split/tools',
        '/en/split/tools/rent-split-calculator',
        '/es-419/split/tools',
        '/pt-br/split/tools/rent-split-calculator',
        '/split-static/_next/static/chunks/app.js',
        '/split-static/fonts/peanut.woff2',
        '/split-static/_next/static/chunks/app/(split-content)/en/split/guides/%5Bslug%5D/page-de3ece0880ae6ac0.js',
        '/split-static/_next/static/chunks/app/(split-content)/es-419/split/guides/%5Bslug%5D/page-de3ece0880ae6ac0.js',
        '/split-static/_next/static/chunks/app/(split-content)/pt-br/split/guides/%5Bslug%5D/page-de3ece0880ae6ac0.js',
        '/split-sitemap.xml',
    ])('stamps and removes every upstream Set-Cookie on literal forwarded path %s', (pathname) => {
        expect(new RegExp(canonicalSplitRoute.src).test(pathname)).toBe(true)
        expect(
            applyRequestHeaderTransforms(pathname, {
                [SPLIT_RAW_ROUTE_HEADER]: 'caller-spoof',
                [SPLIT_RAW_UNSAFE_HEADER]: 'caller-spoof',
            })
        ).toEqual({
            [SPLIT_RAW_ROUTE_HEADER]: SPLIT_RAW_ROUTE_VALUE,
        })
    })

    it.each(SPLIT_CONTENT_RESERVED_PATH_PREFIXES)(
        'never stamps or strips upstream Set-Cookie from reserved parent namespace %s/split',
        (prefix) => {
            const pathname = `${prefix}/split`

            expect(new RegExp(canonicalSplitRoute.src).test(pathname)).toBe(false)
            expect(
                applyRequestHeaderTransforms(pathname, {
                    [SPLIT_RAW_ROUTE_HEADER]: 'caller-spoof',
                    [SPLIT_RAW_UNSAFE_HEADER]: 'caller-spoof',
                })
            ).toEqual({})
        }
    )

    it('mirrors exactly the TypeScript-owned product collision set in its negative lookahead', () => {
        const reservedLookahead = canonicalSplitRoute.src.match(/^\^\/\(\?:\(\?!\(\?:([a-z|-]+)\)\/\)/)

        expect(
            reservedLookahead?.[1]
                .split('|')
                .map((segment) => `/${segment}`)
                .sort()
        ).toEqual(SPLIT_CONTENT_RESERVED_PATH_PREFIXES)
    })

    it.each([
        '/split-static/%2e%2e/home',
        '/split-static/%2E%2E/',
        '/split-static/a/%2e%2e/%2e%2e/home',
        '/split-sitemap.xml/%2e%2e/home',
        '/en/split/guides/split-expenses-across-currencies/%2e%2e/%2e%2e/%2e%2e/%2e%2e/home',
        '/en/split/%2e%2e/%2e%2e/api/exchange-rate',
        '/en/split/tools/%2e%2e/%2e%2e/home',
        '/pt-br/split/alternatives/splitwise/%2e%2e/%2e%2e/%2e%2e/home',
        '/split-static/../home',
        '/split-static/./a.js',
        '/split-static/a/../../home',
        '/split-static/a\\..\\..\\home',
        '/split-static/a\\b.js',
        '/foo/%2e%2e/split-static/a.js',
        '/foo/%252e%252e/split-static/a.js',
        '/foo/%25252e%25252e/random',
        '/foo/%5c..%5chome',
        '/foo/%255C%252E%252E%255Chome',
        '/totally\\unrelated',
    ])('stamps a structural raw-path hazard before normalization: %s', (pathname) => {
        expect(new RegExp(unsafeRawRoute.src).test(pathname)).toBe(true)
        expect(
            applyRequestHeaderTransforms(pathname, {
                [SPLIT_RAW_ROUTE_HEADER]: 'caller-spoof',
                [SPLIT_RAW_UNSAFE_HEADER]: 'caller-spoof',
            })
        ).toEqual({ [SPLIT_RAW_UNSAFE_HEADER]: SPLIT_RAW_UNSAFE_VALUE })
    })

    it.each([
        '/en/travel%20guide',
        '/split-static/file%2Epdf',
        '/split-static/a%2Fb.js',
        '/split-static/a%252Fb.js',
        '/split-static/caf%C3%A9.js',
        '/unrelated/%5Bslug%5D/file.js',
    ])('leaves a benign encoded path unstamped as unsafe: %s', (pathname) => {
        expect(new RegExp(unsafeRawRoute.src).test(pathname)).toBe(false)
        expect(
            applyRequestHeaderTransforms(pathname, { [SPLIT_RAW_UNSAFE_HEADER]: 'caller-spoof' })
        ).not.toHaveProperty(SPLIT_RAW_UNSAFE_HEADER)
    })

    it.each([
        '/split',
        '/hugo/split',
        '/alice/split',
        '/en/split/guides/Bad-Slug',
        '/EN/split/guides/future-guide',
        '/en-US/split/guides/future-guide',
        '/english/split/guides/future-guide',
        '/en/split/alternatives/a/b',
        '/en/split/guides/split-expenses-across-currencies/extra',
        '/split-static',
        '/split-sitemap.xml/extra',
        '/en/%73plit/guides/unknown',
        '/en/split%2Fguides/unknown',
        '/en/%2Fsplit/guides/unknown',
        '/%2Fsplit-static/a.js',
        '/split%2Dstatic/a.js',
        '/split%2Dsitemap.xml',
        '/split-static/a%2Fb.js',
        '/split-static/a//b.js',
        '/SPLIT-STATIC/a.js',
        '/home',
        '/splitter',
    ])('scrubs caller proof but does not stamp non-canonical raw path %s', (pathname) => {
        expect(new RegExp(canonicalSplitRoute.src).test(pathname)).toBe(false)
        expect(
            applyRequestHeaderTransforms(pathname, {
                [SPLIT_RAW_ROUTE_HEADER]: 'caller-spoof',
                [SPLIT_RAW_UNSAFE_HEADER]: 'caller-spoof',
            })
        ).toEqual({})
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
