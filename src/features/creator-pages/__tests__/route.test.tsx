/** @jest-environment node */
import { isValidElement } from 'react'

let mockCookie: { name: string; value: string } | null = null
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'user-agent': '' }),
    cookies: async () => ({ get: (name: string) => (mockCookie?.name === name ? mockCookie : undefined) }),
}))

const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
const params = (username: string) => ({ params: Promise.resolve({ username }) })

/** Next's redirect() and notFound() throw; their digest carries the answer the route sends. */
async function answerOf(run: () => Promise<unknown>): Promise<string> {
    try {
        const element = await run()
        return isValidElement(element) ? 'page' : 'nothing'
    } catch (error) {
        return (error as { digest?: string }).digest ?? String(error)
    }
}

beforeEach(() => {
    mockCookie = null
})
afterAll(() => {
    process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL
})

describe('/c/<username>', () => {
    it('renders the page of a creator with an experiment, the variant the cookie names', async () => {
        const { default: CreatorPageRoute } = await import('@/app/c/[username]/page')
        const { CREATOR_PAGE_COMPONENTS } = await import('../page-components')
        mockCookie = { name: 'cpv_juanacervio', value: 'nita-2026-11-a.e1' }
        const element = await CreatorPageRoute(params('JuanAcervio'))
        expect(element.type).toBe(CREATOR_PAGE_COMPONENTS.juanacervio.e1)
        expect(element.props).toMatchObject({ username: 'juanacervio', variant: 'e1' })
    })

    it.each(['nobody', 'someoneelse', 'constructor'])(
        'answers a 307 to the invite of %s, who has no page',
        async (username) => {
            const { default: CreatorPageRoute } = await import('@/app/c/[username]/page')
            expect(await answerOf(() => CreatorPageRoute(params(username)))).toBe(
                `NEXT_REDIRECT;replace;/invite?code=${username};307;`
            )
        }
    )

    // The segment arrives percent-encoded, as the router hands it over.
    it.each([
        ['encoded control characters', 'a%0d%0ab'],
        ['an encoded right-to-left override', '%E2%80%AEevil'],
        ['a query in the segment', 'a%26b%3Dc'],
        ['broken percent-encoding', 'abc%'],
        ['a name too short for a username', 'ab'],
    ])('is a 404 for %s, never a redirect', async (_case, segment) => {
        const { default: CreatorPageRoute } = await import('@/app/c/[username]/page')
        expect(await answerOf(() => CreatorPageRoute(params(segment)))).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
    })

    it('decodes the segment once before the redirect', async () => {
        const { default: CreatorPageRoute } = await import('@/app/c/[username]/page')
        expect(await answerOf(() => CreatorPageRoute(params('N%6Fbody')))).toBe(
            'NEXT_REDIRECT;replace;/invite?code=nobody;307;'
        )
    })

    it('is noindex, nofollow with the creator title, and noindex without a page', async () => {
        const { generateMetadata } = await import('@/app/c/[username]/page')
        expect(await generateMetadata(params('juanacervio'))).toEqual({
            title: 'Invitación de Nita',
            robots: { index: false, follow: false },
        })
        expect(await generateMetadata(params('someoneelse'))).toEqual({ robots: { index: false, follow: false } })
    })
})

describe('/c/<username>/preview/<variant>', () => {
    async function previewAnswer(baseUrl: string, username: string, variant: string) {
        process.env.NEXT_PUBLIC_BASE_URL = baseUrl
        jest.resetModules()
        const { default: PreviewRoute } = await import('@/app/c/[username]/preview/[variant]/page')
        return answerOf(() => PreviewRoute({ params: Promise.resolve({ username, variant }) }))
    }

    it('is a 404 on peanut.me', async () => {
        expect(await previewAnswer('https://peanut.me', 'juanacervio', 'g2')).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
    })

    it('renders any variant elsewhere, and a 404 for one that does not exist', async () => {
        expect(await previewAnswer('https://staging.peanut.me', 'juanacervio', 'g2')).toBe('page')
        expect(await previewAnswer('https://staging.peanut.me', 'juanacervio', 'zz')).toBe(
            'NEXT_HTTP_ERROR_FALLBACK;404'
        )
    })
})
