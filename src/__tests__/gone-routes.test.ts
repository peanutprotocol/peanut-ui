/** @jest-environment node */
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { GONE_MARKETING_PATHS } from '@/constants/gone-routes.consts'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { config, proxy } from '@/proxy'

const GONE_URLS = SUPPORTED_LOCALES.flatMap((locale) => GONE_MARKETING_PATHS.map((path) => `/${locale}${path}`))

describe('retired marketing pages', () => {
    // Without a matcher entry the proxy never runs and the page renders 200.
    it.each(GONE_URLS)('answers 410: %s', (path) => {
        expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true)
        expect(proxy(new NextRequest(`https://peanut.me${path}`)).status).toBe(410)
    })

    it('leaves send-to-UK alone', () => {
        expect(unstable_doesMiddlewareMatch({ config, url: '/en/send-money-to/united-kingdom' })).toBe(false)
    })
})
