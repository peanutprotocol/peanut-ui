/** @jest-environment jsdom */
import { act } from '@testing-library/react'
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import CreatorPageBoundary from '@/features/tracked-links/CreatorPageBoundary'
import { CREATOR_PAGE_EXPERIMENTS } from '../experiments'
import { creatorPageFixture } from '../preview-fixture'
import { selectCreatorPage } from '../registry'
import { variantCookieName } from '../variant-cookie'
import { USER_AGENTS } from './user-agents'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/features/tracked-links/eligibility', () => ({ trackedLinkAnalyticsAllowed: () => false }))

let mockCookie: { name: string; value: string } | null = null
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'user-agent': USER_AGENTS.instagramIos }),
    cookies: async () => ({ get: (name: string) => (mockCookie?.name === name ? mockCookie : undefined) }),
}))

const handoff = '/go/juanacervio/ig#handoff'

beforeEach(() => {
    window.history.replaceState({}, '', '/go/juanacervio/ig')
})
afterEach(() => {
    jest.restoreAllMocks()
    document.body.innerHTML = ''
})

const CASES = Object.entries(CREATOR_PAGE_EXPERIMENTS).flatMap(([username, experiment]) =>
    experiment.variants.map(({ id }) => [username, id, experiment.id] as const)
)

/**
 * The engine's route renders `<CreatorPageBoundary handoff><Page {...props} /></CreatorPageBoundary>`:
 * an error boundary around `<Suspense fallback={null}>`. This is that tree with the real boundary
 * and the page `selectCreatorPage` returns. The route itself is covered by e2e/flows/creator-pages.spec.ts.
 */
describe.each(CASES)('%s/%s inside the engine boundary', (username, variant, experimentId) => {
    async function tree() {
        mockCookie = { name: variantCookieName(username), value: `${experimentId}.${variant}` }
        const selection = await selectCreatorPage({ username, linkId: `invite_${'a'.repeat(64)}` })
        if (selection?.variant !== variant || !selection.Page) throw new Error(`no page selected for ${variant}`)
        return (
            <CreatorPageBoundary handoff={handoff}>
                {createElement(selection.Page, creatorPageFixture(username, variant))}
            </CreatorPageBoundary>
        )
    }

    it('is in the server HTML as finished content, with its button', async () => {
        // renderToString cannot wait: a page that suspends leaves the fallback, an empty `<!--$!-->`
        // boundary. It does not show the other way a page ends up hidden on /go: the streaming
        // renderer moves a boundary over 12,800 bytes into a hidden block even when nothing suspends.
        // Only the real route shows that (the Playwright spec).
        const html = renderToString(await tree())
        expect(html).toContain('<main')
        expect(html).toContain('<!--$-->')
        expect(html).not.toContain('<!--$!-->')
        expect(html).not.toContain('<template')
        expect(html).toMatch(/<a [^>]*data-cta-position="/)
    })

    it('hydrates without an error and stays on the page', async () => {
        const errors: unknown[] = []
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
        const element = await tree()
        const container = document.createElement('div')
        container.innerHTML = renderToString(element)
        document.body.appendChild(container)
        await act(async () => {
            hydrateRoot(container, element, { onRecoverableError: (error) => errors.push(error) })
        })

        expect(errors).toEqual([])
        expect(consoleError).not.toHaveBeenCalled()
        expect(container.querySelector('main')).not.toBeNull()
        expect(container.querySelector('a[data-cta-position]')).not.toBeNull()
        expect(window.location.hash).toBe('')
    })
})
