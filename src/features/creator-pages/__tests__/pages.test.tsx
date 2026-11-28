/** @jest-environment jsdom */
import { createElement } from 'react'
import { HREFLANG_MAP } from '@/i18n/config'
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { CREATOR_PAGE_EXPERIMENTS } from '../experiments'
import { CREATOR_PAGE_COMPONENTS } from '../page-components'
import { selectCreatorPage } from '../registry'
import { variantCookieName } from '../variant-cookie'
import { USER_AGENTS } from './user-agents'
// The browser server build that jsdom picks needs MessageChannel, which jsdom lacks: use the Node one.
const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')

let mockUserAgent = ''
let mockCookie: { name: string; value: string } | null = null
let mockLanguage: { 'accept-language': string; 'x-vercel-ip-country'?: string } = { 'accept-language': '' }
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'user-agent': mockUserAgent, ...mockLanguage }),
    cookies: async () => ({ get: (name: string) => (mockCookie?.name === name ? mockCookie : undefined) }),
}))

/** A browser whose language the landing-page rule maps to `locale`. */
const BROWSER_LANGUAGE: Record<Locale, typeof mockLanguage> = {
    'es-ar': { 'accept-language': 'es-419,es;q=0.9', 'x-vercel-ip-country': 'AR' },
    'es-419': { 'accept-language': 'es-MX,es;q=0.9', 'x-vercel-ip-country': 'MX' },
    en: { 'accept-language': 'en-US,en;q=0.9', 'x-vercel-ip-country': 'AR' },
    'pt-br': { 'accept-language': 'pt-BR,pt;q=0.9', 'x-vercel-ip-country': 'BR' },
}

/** What each locale's pages must say (the store labels as in the marketing catalog, the legal line as on the landing). */
const EXPECTED: Record<Locale, { notABank: string; ios: string; android: string; other: string }> = {
    'es-ar': {
        notABank: 'Peanut no es un banco.',
        ios: 'Abrir en el App Store',
        android: 'Abrir en Google Play',
        other: 'Bajar Peanut',
    },
    'es-419': {
        notABank: 'Peanut no es un banco.',
        ios: 'Abrir en la App Store',
        android: 'Abrir en Google Play',
        other: 'Descargar Peanut',
    },
    en: {
        notABank: 'Peanut is not a bank.',
        ios: 'Open in the App Store',
        android: 'Open in Google Play',
        other: 'Download Peanut',
    },
    'pt-br': {
        notABank: 'O Peanut não é um banco.',
        ios: 'Abrir na App Store',
        android: 'Abrir no Google Play',
        other: 'Baixar Peanut',
    },
}
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), set_config: jest.fn(), config: {} },
}))
jest.mock('../consent', () => ({ creatorPageAnalyticsAllowed: () => false }))

type RenderedLink = { href: string | null; hasTarget: boolean; hasPosition: boolean; hasIcon: boolean; text: string }

/**
 * The server HTML of a page, selected and rendered as /c/<username> does it: the sticky cookie names
 * the variant, and `selectCreatorPage` reads the user agent. `renderToString` cannot wait, so it
 * throws if a page or the shell suspends.
 */
async function serverRender(username: string, variant: string, userAgent: string, locale: Locale = 'es-ar') {
    mockUserAgent = userAgent
    mockLanguage = BROWSER_LANGUAGE[locale]
    mockCookie = { name: variantCookieName(username), value: `${CREATOR_PAGE_EXPERIMENTS[username].id}.${variant}` }
    const selection = await selectCreatorPage(username)
    if (selection?.props.variant !== variant) throw new Error(`no page selected for ${variant}`)
    if (selection.props.locale !== locale) throw new Error(`${locale} was not selected`)
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
const VARIANTS_IN_LOCALES = VARIANTS.flatMap(([username, variant]) =>
    SUPPORTED_LOCALES.map((locale) => [username, variant, locale] as const)
)

describe('creator page variants', () => {
    it('has one component for every variant of every experiment, and no other', () => {
        const fromExperiments = Object.entries(CREATOR_PAGE_EXPERIMENTS).flatMap(([username, { variants }]) =>
            variants.map(({ id }) => `${username}/${id}`)
        )
        expect(VARIANTS.map(([username, variant]) => `${username}/${variant}`).sort()).toEqual(fromExperiments.sort())
    })

    it.each(VARIANTS_IN_LOCALES)(
        '%s/%s in %s renders what the contract asks of a page',
        async (username, variant, locale) => {
            const { html, links } = await serverRender(username, variant, USER_AGENTS.instagramIos, locale)
            expect(html).toMatch(new RegExp(`<main[^>]*\\slang="${HREFLANG_MAP[locale]}"`))
            // A page may tie "banco." to the word before it with a non-breaking space.
            expect(html.replaceAll('\u00a0', ' ')).toContain(EXPECTED[locale].notABank)
            // No line says who made the page: the context makes it plain (owner ruling, 15 Nov 2026).
            expect(html).not.toContain('hecha por')

            expect(links.length).toBeGreaterThan(0)
            for (const link of links) {
                // Every link is the creator's invite, the target without JavaScript, in the same tab.
                expect(link.href).toBe(`/invite?code=${username}`)
                expect(link.hasTarget).toBe(false)
                expect(link.hasPosition).toBe(true)
            }
        }
    )

    it.each(VARIANTS_IN_LOCALES)(
        '%s/%s in %s has the store label and icon of the device in the server HTML',
        async (username, variant, locale) => {
            const expected = EXPECTED[locale]
            const ios = await serverRender(username, variant, USER_AGENTS.instagramIos, locale)
            for (const link of ios.links) expect(link).toMatchObject({ text: expected.ios, hasIcon: true })
            expect(ios.html).not.toContain('Google Play')

            const android = await serverRender(username, variant, USER_AGENTS.instagramAndroid, locale)
            for (const link of android.links) expect(link).toMatchObject({ text: expected.android, hasIcon: true })
            expect(android.html).not.toContain('App Store')

            const desktop = await serverRender(username, variant, USER_AGENTS.chromeMac, locale)
            for (const link of desktop.links) expect(link).toMatchObject({ text: expected.other, hasIcon: false })
        }
    )

    it.each(VARIANTS)(
        '%s/%s keeps Nita’s quoted words in Spanish, marked es-AR, in every locale',
        async (username, variant) => {
            for (const locale of SUPPORTED_LOCALES) {
                const { html } = await serverRender(username, variant, USER_AGENTS.chromeMac, locale)
                if (variant === 'g2') continue // G2 quotes nothing: its only Spanish is in the Reel frame.
                expect(html).toMatch(/lang="es-AR"[^>]*>[^<]*Lo que yo estoy usando/)
            }
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
