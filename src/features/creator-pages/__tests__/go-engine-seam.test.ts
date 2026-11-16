/** @jest-environment node */
import {
    bareGoVisit,
    goHandoffPath,
    isGoPageLabel,
    parseGoPageVariant,
    type CreatorPageProps,
} from '@/features/tracked-links/contract'
import { goVisitPosthogProperties } from '@/features/tracked-links/visit-properties'
import { selectCreatorPage, type CreatorPageSelection } from '../registry'
import { parseVariantCookie, serializeVariantCookie, variantCookieName } from '../variant-cookie'

// What src/app/go/[slug]/[[...rest]]/page.tsx does with our selection, pinned against the engine's
// own contract module. If the engine changes the seam, this file fails before the route does.

const mockCookies = new Map<string, string>()
jest.mock('next/headers', () => ({
    headers: async () => new Headers(),
    cookies: async () => ({
        get: (name: string) => (mockCookies.has(name) ? { name, value: mockCookies.get(name) } : undefined),
    }),
}))
jest.mock('@/utils/signup-attribution', () => ({ readSignupAttribution: () => null }))

const LINK_ID = 'invite_' + 'a'.repeat(64)

/** The engine's steps between the selection and the page: handoff, then props. */
function engineProps(username: string, selection: CreatorPageSelection): CreatorPageProps {
    const visit = { ...bareGoVisit(username), placement: 'ig' as const }
    return {
        creator: { username, linkId: LINK_ID },
        variant: selection.variant,
        ctaHref: goHandoffPath(visit, selection),
        visit,
    }
}

beforeEach(() => mockCookies.clear())

describe('the /go engine seam', () => {
    it('gives the engine a selection it accepts for Nita: two valid labels and a component', async () => {
        const selection = await selectCreatorPage({ username: 'juanacervio', linkId: LINK_ID })
        expect(selection).not.toBeNull()
        // The engine throws in development and falls back to the redirect on a label that fails this check.
        expect(isGoPageLabel(selection!.variant)).toBe(true)
        expect(isGoPageLabel(selection!.experimentId)).toBe(true)
        expect(typeof selection!.Page).toBe('function')
    })

    it('gives the engine one Spanish tab title per creator, whatever the variant, and leaves robots to it', async () => {
        const titles = new Set<unknown>()
        for (const variant of ['a1', 'g2', 'e1']) {
            mockCookies.set(variantCookieName('juanacervio'), `nita-2026-11-a.${variant}`)
            const selection = await selectCreatorPage({ username: 'juanacervio', linkId: LINK_ID })
            expect(selection!.variant).toBe(variant)
            // A title only: no description, so the link preview keeps the generic Peanut card.
            expect(selection!.metadata).toEqual({ title: 'Invitación de Nita' })
            titles.add(selection!.metadata?.title)
        }
        expect(titles.size).toBe(1)
        // generateMetadata spreads `selection.metadata` under its own `robots`: a page cannot make itself indexable.
        const selection = await selectCreatorPage({ username: 'juanacervio', linkId: LINK_ID })
        expect({ ...selection!.metadata, robots: { index: false, follow: false } }).toEqual({
            title: 'Invitación de Nita',
            robots: { index: false, follow: false },
        })
    })

    it('returns null for a creator without a page, whatever the link id: the engine then redirects', async () => {
        expect(await selectCreatorPage({ username: 'nobodyhasthispage', linkId: LINK_ID })).toBeNull()
    })

    it('lets the engine put the selection into the handoff and read it back unchanged', async () => {
        const selection = (await selectCreatorPage({ username: 'juanacervio', linkId: LINK_ID }))!
        const { ctaHref } = engineProps('juanacervio', selection)
        expect(parseGoPageVariant(new URLSearchParams(ctaHref.split('?')[1]))).toEqual({
            variant: selection.variant,
            experimentId: selection.experimentId,
        })
    })

    it('labels the click with the variant and experiment the engine counts the view under', async () => {
        const selection = (await selectCreatorPage({ username: 'juanacervio', linkId: LINK_ID }))!
        expect(goVisitPosthogProperties(engineProps('juanacervio', selection))).toMatchObject({
            link_id: LINK_ID,
            page_variant: selection.variant,
            page_experiment: selection.experimentId,
        })
    })

    it('keeps a returning visitor on the variant the cookie names', async () => {
        const first = (await selectCreatorPage({ username: 'juanacervio', linkId: LINK_ID }))!
        // What CreatorPageProvider writes in the browser after the first render.
        const written = serializeVariantCookie('juanacervio', {
            experimentId: first.experimentId,
            variantId: first.variant,
        })
        const value = written.split(';')[0].split('=')[1]
        expect(parseVariantCookie(value)).not.toBeNull()
        mockCookies.set(variantCookieName('juanacervio'), value)
        for (let i = 0; i < 30; i++) {
            const again = await selectCreatorPage({ username: 'juanacervio', linkId: LINK_ID })
            expect(again?.variant).toBe(first.variant)
        }
    })
})
