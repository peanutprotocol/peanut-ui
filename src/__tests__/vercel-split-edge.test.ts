/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Vercel Split A2 response transform', () => {
    const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
    const transformRoute = vercelConfig.routes.find((route: { transforms?: unknown }) => route.transforms)

    it('deletes the complete Set-Cookie response header after the external rewrite', () => {
        expect(transformRoute.transforms).toEqual([
            {
                type: 'response.headers',
                op: 'delete',
                target: { key: 'set-cookie' },
            },
        ])
        expect(transformRoute.continue).toBe(true)
    })

    it.each([
        '/en/split/a2-transport',
        '/split-static/_next/a.js',
        '/split-sitemap.xml',
        '/_split-a2/headers',
        '/_split-a2/set-cookie',
    ])('covers forwarded response path %s', (pathname) => {
        expect(new RegExp(transformRoute.src).test(pathname)).toBe(true)
    })

    it.each(['/en/split/a2-transport/extra', '/split-sitemap.xml/extra', '/home', '/splitter'])(
        'does not transform unrelated response path %s',
        (pathname) => {
            expect(new RegExp(transformRoute.src).test(pathname)).toBe(false)
        }
    )
})
