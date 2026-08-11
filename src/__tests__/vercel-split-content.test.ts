/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SPLIT_CANARY_GUIDE_PATHS } from '@/utils/split-content-edge'

interface VercelTransformRoute {
    src: string
    transforms: unknown[]
    continue: boolean
}

describe('Vercel Split response sanitation contract', () => {
    const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
    const transformRoutes = (vercelConfig.routes ?? []).filter(
        (route: Partial<VercelTransformRoute>) => route.transforms !== undefined
    ) as VercelTransformRoute[]

    it('uses the official schema and one scoped response transform', () => {
        expect(vercelConfig.$schema).toBe('https://openapi.vercel.sh/vercel.json')
        expect(transformRoutes).toHaveLength(1)
        expect(transformRoutes[0]).toMatchObject({
            continue: true,
            transforms: [
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
    ])('removes every upstream Set-Cookie on forwarded response %s', (pathname) => {
        expect(new RegExp(transformRoutes[0].src).test(pathname)).toBe(true)
    })

    it.each([
        '/split',
        '/en/split',
        '/en/split/guides/unknown',
        '/fr/split/guides/split-expenses-across-currencies',
        '/en/split/guides/split-expenses-across-currencies/extra',
        '/split-static',
        '/split-sitemap.xml/extra',
        '/home',
        '/splitter',
    ])('does not transform non-forwarded response %s', (pathname) => {
        expect(new RegExp(transformRoutes[0].src).test(pathname)).toBe(false)
    })
})
