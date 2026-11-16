/** @jest-environment node */
import { NextRequest } from 'next/server'

const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

// The gate reads env at module load, so the proxy is imported again as each build.
async function proxyOf(baseUrl: string) {
    process.env.NEXT_PUBLIC_BASE_URL = baseUrl
    jest.resetModules()
    return (await import('@/proxy')).proxy
}

afterAll(() => {
    process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL
    jest.resetModules()
})

const PREVIEW_PATHS = ['/dev/creator-pages', '/dev/creator-pages/juanacervio/a1', '/dev/creator-pages/juanacervio/e1']

/**
 * The preview renders creator pages from a fixture, with a fixture link id in its button. It must
 * not answer on the production site. src/__tests__/dev-routes-gate.test.ts covers every /dev route
 * by walking the disk; this names the preview, so moving it out of /dev fails here.
 */
describe('the creator page preview', () => {
    it.each(PREVIEW_PATHS)('is a 404 on peanut.me: %s', async (path) => {
        const proxy = await proxyOf('https://peanut.me')
        expect(proxy(new NextRequest(`https://peanut.me${path}`))?.status).toBe(404)
    })

    it.each(PREVIEW_PATHS)('answers on a preview deployment: %s', async (path) => {
        const proxy = await proxyOf('https://staging.peanut.me')
        expect(proxy(new NextRequest(`https://staging.peanut.me${path}`))?.status).not.toBe(404)
    })
})

describe('the creator page preview title', () => {
    it("is the creator's tab title, read from the experiment as on /go", async () => {
        const [{ generateMetadata }, { CREATOR_PAGE_EXPERIMENTS }] = await Promise.all([
            import('@/app/dev/creator-pages/[username]/[variant]/page'),
            import('../experiments'),
        ])
        const params = Promise.resolve({ username: 'juanacervio', variant: 'g2' })
        expect(await generateMetadata({ params })).toEqual({ title: CREATOR_PAGE_EXPERIMENTS.juanacervio.title })
        expect(CREATOR_PAGE_EXPERIMENTS.juanacervio.title).toBe('Invitación de Nita')
    })

    it('leaves the site title on an unknown creator, which is a 404', async () => {
        const { generateMetadata } = await import('@/app/dev/creator-pages/[username]/[variant]/page')
        expect(await generateMetadata({ params: Promise.resolve({ username: 'nobody', variant: 'g2' }) })).toEqual({})
    })
})
