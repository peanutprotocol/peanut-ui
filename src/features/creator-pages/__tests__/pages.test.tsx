/** @jest-environment node */
import { Writable } from 'node:stream'
import { createElement } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { creatorPageFixture } from '../creator-page-fixture'
import { CREATOR_PAGE_EXPERIMENTS } from '../experiments'
import { CREATOR_PAGE_COMPONENTS } from '../page-components'
import { USER_AGENTS } from './user-agents'

let mockUserAgent = ''
jest.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': mockUserAgent }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

type RenderedLink = { href: string | null; hasTarget: boolean; hasPosition: boolean; hasIcon: boolean; text: string }

/**
 * The server HTML of a page, as /go sends it. The shell is an async server component, so a
 * client render cannot show it; React's server renderer can.
 */
async function serverRender(username: string, variant: string, userAgent: string) {
    mockUserAgent = userAgent
    const props = creatorPageFixture(username, variant)
    const html = await new Promise<string>((resolve, reject) => {
        const chunks: string[] = []
        const sink = new Writable({
            write(chunk, _encoding, done) {
                chunks.push(String(chunk))
                done()
            },
            final(done) {
                resolve(chunks.join(''))
                done()
            },
        })
        const stream = renderToPipeableStream(createElement(CREATOR_PAGE_COMPONENTS[username][variant], props), {
            onAllReady: () => stream.pipe(sink),
            onError: reject,
        })
    })
    const links: RenderedLink[] = [...html.matchAll(/<a\s([^>]*)>(.*?)<\/a>/gs)].map(([, attributes, inner]) => ({
        href: /\bhref="([^"]*)"/.exec(attributes)?.[1].replaceAll('&amp;', '&') ?? null,
        hasTarget: /\btarget=/.test(attributes),
        hasPosition: /\bdata-cta-position=/.test(attributes),
        hasIcon: inner.includes('<svg'),
        text: inner.replace(/<svg.*?<\/svg>/gs, '').replace(/<[^>]+>/g, ''),
    }))
    return { props, html, links }
}

const VARIANTS = Object.entries(CREATOR_PAGE_COMPONENTS).flatMap(([username, pages]) =>
    Object.keys(pages).map((variant) => [username, variant] as const)
)

describe('creator page variants', () => {
    it('has one component for every variant of every experiment, and no other', () => {
        const fromExperiments = Object.entries(CREATOR_PAGE_EXPERIMENTS).flatMap(([username, { variants }]) =>
            variants.map(({ id }) => `${username}/${id}`)
        )
        expect(VARIANTS.map(([username, variant]) => `${username}/${variant}`).sort()).toEqual(fromExperiments.sort())
    })

    it.each(VARIANTS)('%s/%s renders what the contract asks of a page', async (username, variant) => {
        const { props, html, links } = await serverRender(username, variant, USER_AGENTS.instagramIos)
        expect(html).toMatch(/<main[^>]*\slang="es-AR"/)
        expect(html).toContain('Peanut no es un banco.')

        expect(links.length).toBeGreaterThan(0)
        for (const link of links) {
            // Every link is the engine's button target, unchanged and in the same tab.
            expect(link.href).toBe(props.ctaHref)
            expect(link.hasTarget).toBe(false)
            expect(link.hasPosition).toBe(true)
        }
    })

    it.each(VARIANTS)(
        '%s/%s has the store label and icon of the device in the server HTML',
        async (username, variant) => {
            const ios = await serverRender(username, variant, USER_AGENTS.instagramIos)
            for (const link of ios.links) expect(link).toMatchObject({ text: 'Abrir en App Store', hasIcon: true })
            expect(ios.html).not.toContain('Google Play')

            const android = await serverRender(username, variant, USER_AGENTS.instagramAndroid)
            for (const link of android.links)
                expect(link).toMatchObject({ text: 'Abrir en Google Play', hasIcon: true })
            expect(android.html).not.toContain('App Store')
        }
    )
})
