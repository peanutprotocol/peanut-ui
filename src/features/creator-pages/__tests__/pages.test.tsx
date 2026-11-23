/** @jest-environment jsdom */
import { createElement } from 'react'
import { CREATOR_PAGE_EXPERIMENTS } from '../experiments'
import { CREATOR_PAGE_COMPONENTS } from '../page-components'
import { selectCreatorPage } from '../registry'
import { variantCookieName } from '../variant-cookie'
import { USER_AGENTS } from './user-agents'
// The browser server build that jsdom picks needs MessageChannel, which jsdom lacks: use the Node one.
const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')

let mockUserAgent = ''
let mockCookie: { name: string; value: string } | null = null
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'user-agent': mockUserAgent }),
    cookies: async () => ({ get: (name: string) => (mockCookie?.name === name ? mockCookie : undefined) }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('../consent', () => ({ creatorPageAnalyticsAllowed: () => false }))

type RenderedLink = { href: string | null; hasTarget: boolean; hasPosition: boolean; hasIcon: boolean; text: string }

/**
 * The server HTML of a page, selected and rendered as /c/<username> does it: the sticky cookie names
 * the variant, and `selectCreatorPage` reads the user agent. `renderToString` cannot wait, so it
 * throws if a page or the shell suspends.
 */
async function serverRender(username: string, variant: string, userAgent: string) {
    mockUserAgent = userAgent
    mockCookie = { name: variantCookieName(username), value: `${CREATOR_PAGE_EXPERIMENTS[username].id}.${variant}` }
    const selection = await selectCreatorPage(username)
    if (selection?.props.variant !== variant) throw new Error(`no page selected for ${variant}`)
    const html = renderToString(createElement(selection.Page, selection.props))
    // jsdom only parses the server HTML here; nothing is rendered into its document.
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const links: RenderedLink[] = [...parsed.querySelectorAll('a')].map((link) => {
        const label = link.cloneNode(true) as HTMLAnchorElement
        label.querySelectorAll('svg').forEach((icon) => icon.remove())
        return {
            href: link.getAttribute('href'),
            hasTarget: link.hasAttribute('target'),
            hasPosition: link.hasAttribute('data-cta-position'),
            hasIcon: link.querySelector('svg') !== null,
            text: label.textContent ?? '',
        }
    })
    return { html, links }
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
        const { html, links } = await serverRender(username, variant, USER_AGENTS.instagramIos)
        expect(html).toMatch(/<main[^>]*\slang="es-AR"/)
        // A page may tie "banco." to the word before it with a non-breaking space.
        expect(html.replaceAll('\u00a0', ' ')).toContain('Peanut no es un banco.')
        // No line says who made the page: the context makes it plain (owner ruling, 15 Nov 2026).
        expect(html).not.toContain('hecha por')

        expect(links.length).toBeGreaterThan(0)
        for (const link of links) {
            // Every link is the creator's invite, the target without JavaScript, in the same tab.
            expect(link.href).toBe(`/invite?code=${username}`)
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
