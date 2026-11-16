/** @jest-environment node */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { CREATOR_PAGE_EXPERIMENTS } from '../experiments'
import { CREATOR_PAGE_COMPONENTS } from '../page-components'
import { creatorPageFixture } from '../preview-fixture'
import { selectCreatorPage } from '../registry'
import { variantCookieName } from '../variant-cookie'
import { USER_AGENTS } from './user-agents'

let mockUserAgent = ''
let mockCookie: { name: string; value: string } | null = null
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'user-agent': mockUserAgent }),
    cookies: async () => ({ get: (name: string) => (mockCookie?.name === name ? mockCookie : undefined) }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

type RenderedLink = { href: string | null; hasTarget: boolean; hasPosition: boolean; hasIcon: boolean; text: string }

/**
 * The server HTML of a page, selected and rendered as /go does it: the sticky cookie names the
 * variant, and `selectCreatorPage` reads the user agent. `renderToString` cannot wait, so it
 * throws if a page or the shell suspends; on /go such a page would arrive in a hidden block.
 */
async function serverRender(username: string, variant: string, userAgent: string) {
    mockUserAgent = userAgent
    mockCookie = { name: variantCookieName(username), value: `${CREATOR_PAGE_EXPERIMENTS[username].id}.${variant}` }
    const selection = await selectCreatorPage({ username, linkId: 'invite_' + '0'.repeat(64) })
    if (selection?.variant !== variant || !selection.Page) throw new Error(`no page selected for ${variant}`)
    const props = creatorPageFixture(username, variant)
    const html = renderToString(createElement(selection.Page, props))
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
        // A page may tie "banco." to the word before it with a non-breaking space.
        expect(html.replaceAll('\u00a0', ' ')).toContain('Peanut no es un banco.')
        // No line says who made the page: the context makes it plain (owner ruling, 15 Nov 2026).
        expect(html).not.toContain('hecha por')

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
            for (const link of ios.links) expect(link).toMatchObject({ text: 'Abrir en el App Store', hasIcon: true })
            expect(ios.html).not.toContain('Google Play')

            const android = await serverRender(username, variant, USER_AGENTS.instagramAndroid)
            for (const link of android.links)
                expect(link).toMatchObject({ text: 'Abrir en Google Play', hasIcon: true })
            expect(android.html).not.toContain('App Store')

            const desktop = await serverRender(username, variant, USER_AGENTS.chromeMac)
            for (const link of desktop.links) expect(link).toMatchObject({ text: 'Bajar Peanut', hasIcon: false })
        }
    )

    it.each(VARIANTS)(
        '%s/%s lifts its bottom buttons only in Instagram and Facebook on an iPhone',
        async (username, variant) => {
            // Those two draw their controls over the bottom of the page. The mark is in the server
            // HTML, so the lift is there before any script runs.
            const lifted = /<main[^>]*\sdata-lift-cta(=""|[\s>])/
            for (const name of ['instagramIos', 'facebookIos'] as const)
                expect((await serverRender(username, variant, USER_AGENTS[name])).html).toMatch(lifted)
            for (const name of ['instagramAndroid', 'safariIos', 'xIos', 'chromeMac'] as const)
                expect((await serverRender(username, variant, USER_AGENTS[name])).html).not.toContain('data-lift-cta')
        }
    )
})
