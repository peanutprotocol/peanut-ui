/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'

type Redirect = {
    source: string
    destination: string
    permanent: boolean
}

const redirects = JSON.parse(readFileSync(resolve(process.cwd(), 'redirects.json'), 'utf8')) as Redirect[]
const nextConfig = {
    async redirects() {
        return redirects
    },
}

const localeAliases = [
    ['es', 'es-419'],
    ['pt', 'pt-br'],
    ['es-es', 'es-419'],
] as const

async function configuredResponse(pathname: string) {
    return unstable_getResponseFromNextConfig({
        url: `https://peanut.me${pathname}`,
        nextConfig,
    })
}

describe('legacy locale redirects preserve the future Split namespace', () => {
    it.each(localeAliases)('keeps the exact /%s alias redirect to /%s', async (source, destination) => {
        const response = await configuredResponse(`/${source}`)

        expect(response.status).toBe(308)
        expect(getRedirectUrl(response)).toBe(`https://peanut.me/${destination}`)
    })

    it.each(localeAliases)('preserves legacy trailing-slash normalization below /%s', async (source) => {
        for (const suffix of ['', 'legacy/', 'legacy/nested/']) {
            const response = await configuredResponse(`/${source}/${suffix}`)

            expect(response.status).toBe(308)
            expect(getRedirectUrl(response)).toBe(
                `https://peanut.me/${source}${suffix ? `/${suffix.slice(0, -1)}` : ''}`
            )
        }
    })

    it.each(localeAliases)(
        'preserves single- and multi-segment legacy redirects below /%s',
        async (source, destination) => {
            for (const suffix of ['legacy-page', 'legacy/nested/page', 'splitting-expenses']) {
                const response = await configuredResponse(`/${source}/${suffix}`)

                expect(response.status).toBe(308)
                expect(getRedirectUrl(response)).toBe(`https://peanut.me/${destination}/${suffix}`)
            }
        }
    )

    it.each(['es', 'pt', 'es-es', 'sh'])(
        'does not redirect /%s/split or any case-variant descendant before the Split edge',
        async (source) => {
            for (const suffix of ['split', 'split/guides/future-guide', 'SPLIT/tools/future-tool']) {
                const response = await configuredResponse(`/${source}/${suffix}`)

                expect(response.status).toBe(200)
                expect(getRedirectUrl(response)).toBeNull()
            }
        }
    )

    it('keeps the legacy sh shortlink behavior outside its freed Split subtree', async () => {
        for (const pathname of ['/sh', '/sh/legacy', '/sh/legacy/nested', '/sh/splitting']) {
            const response = await configuredResponse(pathname)

            expect(response.status).toBe(307)
            expect(getRedirectUrl(response)).toBe('https://peanut.me/card')
        }
    })

    it('pins the four wildcard sources to the same bounded exclusion grammar', () => {
        expect(
            redirects
                .filter(({ source }) => ['/es/', '/pt/', '/es-es/', '/sh/'].some((prefix) => source.startsWith(prefix)))
                .map(({ source }) => source)
        ).toEqual([
            '/es/:path((?![sS][pP][lL][iI][tT](?:/|$))[^/]+(?:/[^/]+)*)',
            '/pt/:path((?![sS][pP][lL][iI][tT](?:/|$))[^/]+(?:/[^/]+)*)',
            '/es-es/:path((?![sS][pP][lL][iI][tT](?:/|$))[^/]+(?:/[^/]+)*)',
            '/sh/:path((?![sS][pP][lL][iI][tT](?:/|$))[^/]+(?:/[^/]+)*)',
        ])
    })

    it('keeps malformed double-slash aliases outside the custom redirects', async () => {
        for (const source of ['es', 'pt', 'es-es', 'sh']) {
            const response = await configuredResponse(`/${source}//legacy`)

            expect(response.status).toBe(200)
            expect(getRedirectUrl(response)).toBeNull()
        }
    })
})
