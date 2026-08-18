/** @jest-environment node */

import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import type { NextConfig } from 'next'
import redirects from '../../redirects.json'

type Redirects = Awaited<ReturnType<NonNullable<NextConfig['redirects']>>>

const nextConfig: NextConfig = {
    // Production deliberately owns slash normalization in redirects.json so
    // the locale-root exception can stay loop-free and /relay POSTs untouched.
    skipTrailingSlashRedirect: true,
    async redirects() {
        return redirects as unknown as Redirects
    },
}

async function evaluate(path: string) {
    return unstable_getResponseFromNextConfig({
        url: `https://peanut.me${path}`,
        nextConfig,
    })
}

describe('production SEO redirects', () => {
    it.each([
        ['/help/delete-account?from=legacy', 308, 'https://peanut.me/en/help/delete-account?from=legacy'],
        ['/pricing', 308, 'https://peanut.me/en/pricing'],
        ['/stories', 308, 'https://peanut.me/en/stories'],
        ['/stories/customer-one', 308, 'https://peanut.me/en/stories/customer-one'],
        ['/content', 308, 'https://peanut.me/en/content'],
        ['/es-ar/help/', 308, 'https://peanut.me/es-ar/help'],
    ])('%s returns %i and redirects to %s', async (path, status, destination) => {
        const response = await evaluate(path)
        expect(response.status).toBe(status)
        expect(getRedirectUrl(response)).toBe(destination)
    })

    it.each(['/es-ar', '/es-ar/', '/relay/decide/'])('%s is not caught by slash normalization', async (path) => {
        const response = await evaluate(path)
        expect(getRedirectUrl(response)).toBeNull()
    })

    it('preserves the current-main press-kit destination', async () => {
        const response = await evaluate('/presskit')
        expect(response.status).toBe(308)
        expect(getRedirectUrl(response)).toBe(
            'https://peanutprotocol.notion.site/Press-Kit-12f83811757981fc9ca5de581b20f50d'
        )
    })

    it('preserves both press-kit aliases and the docs.peanut.to host rule', () => {
        const notion = 'https://peanutprotocol.notion.site/Press-Kit-12f83811757981fc9ca5de581b20f50d'
        for (const source of ['/presskit', '/press-kit']) {
            expect(redirects.find((rule) => rule.source === source)).toMatchObject({
                destination: notion,
                permanent: true,
            })
        }
        expect(
            redirects.find(
                (rule) =>
                    rule.source === '/:path*' && rule.has?.some((condition) => condition.value === 'docs.peanut.to')
            )
        ).toMatchObject({ destination: 'https://peanut.me/en/help', permanent: true })
    })

    it('keeps the retired es-es locale and every subpath redirected', () => {
        expect(redirects.find((rule) => rule.source === '/es-es')).toMatchObject({
            destination: '/es-419',
            permanent: true,
        })
        expect(redirects.find((rule) => rule.source === '/es-es/:path*')).toMatchObject({
            destination: '/es-419/:path*',
            permanent: true,
        })
    })
})
