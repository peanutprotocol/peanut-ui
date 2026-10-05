/** @jest-environment node */
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { GONE_MARKETING_PATHS } from '@/constants/gone-routes.consts'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { config, proxy } from '@/proxy'
import generateSitemap from '@/app/sitemap'

const GONE_URLS = SUPPORTED_LOCALES.flatMap((locale) => GONE_MARKETING_PATHS.map((path) => `/${locale}${path}`))

function runProxy(path: string) {
    return proxy(new NextRequest(`https://peanut.me${path}`))
}

describe('retired marketing pages', () => {
    it.each(GONE_URLS)('answers 410 with noindex: %s', (path) => {
        const response = runProxy(path)

        expect(response.status).toBe(410)
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
    })

    // Without a matcher entry the proxy never runs and the page renders 200.
    it.each(GONE_URLS)('is covered by the proxy matcher: %s', (path) => {
        expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true)
    })

    it('does not pull other marketing pages into the proxy', () => {
        expect(unstable_doesMiddlewareMatch({ config, url: '/en/germany' })).toBe(false)
        expect(unstable_doesMiddlewareMatch({ config, url: '/en/send-money-to/united-kingdom' })).toBe(false)
    })

    // Pages for non-UK users about UK rails stay up.
    it.each([
        '/en/send-money-to/united-kingdom',
        '/en/receive-money-from/united-kingdom',
        '/en/send-money-from/united-states/to/argentina',
        '/en/send-money-from/united-kingdom/to/mexico',
        '/en/germany',
        '/fr/united-kingdom',
        '/united-kingdom',
    ])('leaves %s alone', (path) => {
        expect(runProxy(path).status).not.toBe(410)
    })

    // The content mirror may still hold their files; the sitemap must not list them.
    it('keeps them out of the sitemap', async () => {
        const paths = (await generateSitemap()).map((entry) => new URL(entry.url).pathname)

        expect(paths).toContain('/en/send-money-to/united-kingdom')
        expect(paths.filter((path) => GONE_URLS.includes(path))).toEqual([])
    })
})
