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
let mockCookies: Record<string, string> = {}
jest.mock('next/headers', () => ({
    // An Argentine visitor: Spanish browser, Argentine IP. The shared landing-page rule gives es-ar.
    headers: async () =>
        new Headers({ 'user-agent': mockUserAgent, 'accept-language': 'es-419,es;q=0.9', 'x-vercel-ip-country': 'AR' }),
    cookies: async () => ({
        get: (name: string) => (name in mockCookies ? { name, value: mockCookies[name] } : undefined),
    }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), set_config: jest.fn(), config: {} },
}))
jest.mock('../consent', () => ({ creatorPageAnalyticsAllowed: () => false }))

/** Every visible text, alt text and aria label of a page's server HTML, in document order. */
function readableText(html: string): string[] {
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const out: string[] = []
    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent?.trim()) out.push(node.textContent)
            return
        }
        if (node instanceof Element) {
            for (const attribute of ['alt', 'aria-label']) {
                const value = node.getAttribute(attribute)
                if (value) out.push(`[${attribute}] ${value}`)
            }
        }
        node.childNodes.forEach(walk)
    }
    walk(parsed.body)
    return out
}

const VARIANTS = Object.entries(CREATOR_PAGE_COMPONENTS).flatMap(([username, pages]) =>
    Object.keys(pages).map((variant) => [username, variant] as const)
)

describe('approved es-AR copy', () => {
    // The snapshot was written from the pages before they had other locales (TASK-25359). It must
    // never change without a copy approval: es-AR is the approved wording, byte for byte.
    it.each(VARIANTS)('%s/%s renders the approved es-AR wording', async (username, variant) => {
        const texts: Record<string, string[]> = {}
        for (const [device, userAgent] of [
            ['ios', USER_AGENTS.instagramIos],
            ['android', USER_AGENTS.instagramAndroid],
            ['other', USER_AGENTS.chromeMac],
        ] as const) {
            mockUserAgent = userAgent
            mockCookies = { [variantCookieName(username)]: `${CREATOR_PAGE_EXPERIMENTS[username].id}.${variant}` }
            const selection = await selectCreatorPage(username)
            if (selection?.props.variant !== variant) throw new Error(`no page selected for ${variant}`)
            texts[device] = readableText(renderToString(createElement(selection.Page, selection.props)))
        }
        expect(texts).toMatchSnapshot()
    })
})
