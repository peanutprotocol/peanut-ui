/** @jest-environment node */
import type { ReactElement } from 'react'
import { headers } from 'next/headers'
import GoPage, { generateMetadata } from '@/app/go/[slug]/[[...rest]]/page'
import { selectCreatorPage, type CreatorPageSelection } from '@/features/creator-pages/registry'
import { GO_PLACEMENTS, parseGoRequest, type CreatorPageProps } from '@/features/tracked-links/contract'
import CreatorPageBoundary from '@/features/tracked-links/CreatorPageBoundary'
import TrackedLinkEntry from '@/features/tracked-links/TrackedLinkEntry'

jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.example.test' }))
jest.mock('@/features/tracked-links/contract', () => {
    const actual = jest.requireActual('@/features/tracked-links/contract')
    return { ...actual, parseGoRequest: jest.fn(actual.parseGoRequest) }
})
jest.mock('next/headers', () => ({ headers: jest.fn() }))
jest.mock('@/features/tracked-links/go-map', () => {
    const actual = jest.requireActual('@/features/tracked-links/go-map')
    const redirects = { shortlink: '/en/pricing?utm_source=flyer', 'promo/flyer': '/app' }
    return { ...actual, resolveGoRedirect: (segments: string[]) => actual.resolveGoRedirect(segments, redirects) }
})
jest.mock('@/features/creator-pages/registry', () => ({ selectCreatorPage: jest.fn() }))
jest.mock('@/features/tracked-links/TrackedLinkEntry', () => ({ __esModule: true, default: () => null }))
// React's cache memoizes only inside a server request; this stands in for one, cleared per request.
jest.mock('react', () => {
    const memos: Map<string, unknown>[] = []
    return {
        ...jest.requireActual('react'),
        cache: (fn: (...args: unknown[]) => unknown) => {
            const memo = new Map<string, unknown>()
            memos.push(memo)
            return (...args: unknown[]) => {
                const key = JSON.stringify(args)
                if (!memo.has(key)) memo.set(key, fn(...args))
                return memo.get(key)
            }
        },
        mockNewRequest: () => memos.forEach((memo) => memo.clear()),
    }
})

const originalFetch = global.fetch
const env = process.env as Record<string, string | undefined>
const nodeEnv = env.NODE_ENV
const linkId = `invite_${'a'.repeat(64)}`
type GoParams = { slug: string; rest?: string[] }

const newRequest = (jest.requireMock('react') as { mockNewRequest: () => void }).mockNewRequest
function pageProps(url: URL, slug: string, rest?: string[]) {
    const search: Record<string, string | string[]> = {}
    for (const key of new Set(url.searchParams.keys())) {
        const values = url.searchParams.getAll(key)
        search[key] = values.length > 1 ? values : values[0]
    }
    const params: GoParams = rest ? { slug, rest } : { slug }
    return { params: Promise.resolve(params), searchParams: Promise.resolve(search) }
}
let rendered: ReactElement | undefined
/** Renders the page as Next answers it: a thrown redirect or 404 becomes the response. */
async function go(request: Request, slug: string, rest?: string[], sameRequest = false): Promise<Response> {
    if (!sameRequest) newRequest()
    jest.mocked(headers).mockResolvedValue(request.headers as never)
    try {
        rendered = await GoPage(pageProps(new URL(request.url), slug, rest))
        return new Response('page', { status: 200 })
    } catch (error) {
        const digest = (error as { digest?: string }).digest ?? ''
        const [code, , url, status] = digest.split(';')
        if (code === 'NEXT_REDIRECT') return new Response(null, { status: Number(status), headers: { Location: url } })
        if (digest === 'NEXT_HTTP_ERROR_FALLBACK;404') return new Response('Link not found.', { status: 404 })
        throw error
    }
}
const open = (slug: string, query = '', rest?: string[], headers?: Record<string, string>) =>
    go(new Request(`https://peanut.me/go/${[slug, ...(rest ?? [])].join('/')}${query}`, { headers }), slug, rest)
const location = (response: Response) => response.headers.get('location')
const handoff = (response: Response) =>
    Object.fromEntries(new URL(location(response)!, 'https://peanut.me').searchParams)
// The lookup cache is module state; a fresh slug per test keeps each lookup observable.
let n = 0
const fresh = () => `creator${n++}`
const linkNotFound = () => Response.json({ error: 'Link not found' }, { status: 404 })
const select = (selection: CreatorPageSelection | null) => jest.mocked(selectCreatorPage).mockResolvedValue(selection)
function TestPage(_props: CreatorPageProps) {
    return null
}

beforeEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
    rendered = undefined
    global.fetch = jest.fn().mockResolvedValue(Response.json({ linkId }))
    select(null)
})
afterEach(() => {
    env.NODE_ENV = nodeEnv
})
afterAll(() => {
    global.fetch = originalFetch
})

describe('a creator without a page keeps the redirect', () => {
    it('hands a known creator to the app entry, dropping every incoming query parameter', async () => {
        const slug = fresh()
        const response = await open(slug, '?invite=mallory&dest=https://evil.test&fbclid=secret')
        expect(response.status).toBe(307)
        const target = new URL(location(response)!, 'https://peanut.me')
        expect(target.pathname).toBe('/home')
        expect(Object.fromEntries(target.searchParams)).toEqual({ app_entry: '1', tl: slug, acq_invite: slug })
        expect(global.fetch).toHaveBeenCalledWith(
            `https://api.example.test/tracked-links/invites/${slug}`,
            expect.objectContaining({ redirect: 'error', headers: { Accept: 'application/json' } })
        )
        expect(selectCreatorPage).toHaveBeenCalledWith({ username: slug, linkId })
    })

    it('hands a capitalised username and placement straight to the lowercase creator, without a 308', async () => {
        const slug = fresh()
        const response = await open(slug.replace('creator', 'Creator'), '', ['IG'])
        expect(response.status).toBe(307)
        expect(handoff(response)).toEqual({ app_entry: '1', tl: slug, acq_invite: slug, tl_s: 'ig' })
    })

    it.each(Object.keys(GO_PLACEMENTS))('carries placement %s as tl_s', async (placement) => {
        expect(handoff(await open(fresh(), '', [placement])).tl_s).toBe(placement)
    })

    it.each(['1', '9999'])('carries code %s as tl_s', async (code) => {
        expect(handoff(await open(fresh(), '', [code])).tl_s).toBe(code)
    })

    it.each([[['0']], [['07']], [['10000']], [['zz']], [['ig', '7']], [['%C4%80']], [['Ā']]])(
        'treats suffix %j as the bare link, never a 404',
        async (rest) => {
            const slug = fresh()
            const response = await open(slug, '', rest)
            expect(response.status).toBe(307)
            expect(handoff(response)).toEqual({ app_entry: '1', tl: slug, acq_invite: slug })
        }
    )

    it('keeps the first of duplicate utm keys and only clean, allowlisted values', async () => {
        const slug = fresh()
        const response = await open(
            slug,
            `?utm_source=first&utm_source=second&utm_medium=banner&utm_campaign=${'a'.repeat(65)}&utm_content=a%40b.com`
        )
        expect(handoff(response)).toEqual({ app_entry: '1', tl: slug, acq_invite: slug, utm_source: 'first' })
    })

    it.each([
        'utm_campaign=https%3A%2F%2Fevil.test',
        'utm_campaign=123e4567-e89b-42d3-a456-426614174000',
        'fbclid=x&utm_term=y&tl=mallory&acq_invite=mallory&invite=mallory&code=mallory&badge_campaign=nita&tl_v=a1&tl_e=n1',
    ])('never carries %s into the handoff', async (query) => {
        const slug = fresh()
        expect(handoff(await open(slug, `?${query}`))).toEqual({ app_entry: '1', tl: slug, acq_invite: slug })
    })

    it('carries the allowlisted tags and the referrer host together', async () => {
        const response = await open(fresh(), '?utm_medium=cpc&utm_campaign=ar-push&utm_content=reel', ['7'], {
            referer: 'https://l.instagram.com/x',
        })
        expect(handoff(response)).toMatchObject({
            tl_s: '7',
            utm_medium: 'cpc',
            utm_campaign: 'ar-push',
            utm_content: 'reel',
            tl_r: 'l.instagram.com',
        })
    })

    it.each(['http://localhost:3000/', 'http://192.168.0.1/', 'https://peanut.me/invite', undefined])(
        'records no referrer host for %p',
        async (referer) => {
            const response = await open(fresh(), '', undefined, referer ? { referer } : undefined)
            expect(handoff(response).tl_r).toBeUndefined()
        }
    )
})

describe('lookup answers', () => {
    it.each(['al-ice', 'a'.repeat(65), 'ali%2Fce'])(
        'answers 404 for a slug that cannot be a username: %s',
        async (slug) => {
            const response = await open(slug)
            expect(response.status).toBe(404)
            expect(global.fetch).not.toHaveBeenCalled()
        }
    )

    it('answers 404 for an unknown creator', async () => {
        jest.mocked(global.fetch).mockImplementation(() => Promise.resolve(linkNotFound()))
        const response = await open(fresh())
        expect(response.status).toBe(404)
        expect(location(response)).toBeNull()
        expect(selectCreatorPage).not.toHaveBeenCalled()
    })

    it.each([
        ['a 5xx', () => Promise.resolve(new Response(null, { status: 503 }))],
        ['a timeout', () => Promise.reject(new DOMException('timed out', 'TimeoutError'))],
        ['a malformed body', () => Promise.resolve(Response.json({ username: 'alice' }))],
        // Fastify's answer while the backend route is not deployed yet.
        [
            'a generic route-not-found 404',
            () =>
                Promise.resolve(
                    Response.json(
                        {
                            message: 'Route GET:/tracked-links/invites/x not found',
                            error: 'Not Found',
                            statusCode: 404,
                        },
                        { status: 404 }
                    )
                ),
        ],
        ['an empty 404', () => Promise.resolve(new Response(null, { status: 404 }))],
    ])('falls back to the plain store entry without attribution on %s', async (_case, reply) => {
        jest.mocked(global.fetch).mockImplementation(reply)
        const response = await open(fresh(), '', ['ig'])
        expect(response.status).toBe(307)
        expect(location(response)).toBe('/home?app_entry=1')
    })

    it('reuses found and unknown answers for a minute, but never an outage', async () => {
        jest.useFakeTimers({ now: 0 })
        const found = fresh()
        await open(found)
        await open(found)
        expect(global.fetch).toHaveBeenCalledTimes(1)
        jest.setSystemTime(60_001)
        await open(found)
        expect(global.fetch).toHaveBeenCalledTimes(2)

        const unknown = fresh()
        jest.mocked(global.fetch).mockImplementation(() => Promise.resolve(linkNotFound()))
        await open(unknown)
        expect((await open(unknown)).status).toBe(404)
        expect(global.fetch).toHaveBeenCalledTimes(3)

        const down = fresh()
        jest.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 503 }))
        await open(down)
        jest.mocked(global.fetch).mockResolvedValue(Response.json({ linkId }))
        expect(location(await open(down))).toContain('acq_invite=')
        expect(global.fetch).toHaveBeenCalledTimes(5)
    })
})

describe('short links', () => {
    it('answers a 307 to the mapped path, dropping the query, without a creator lookup', async () => {
        const response = await open('ShortLink', '?utm_source=mallory')
        expect(response.status).toBe(307)
        expect(location(response)).toBe('/en/pricing?utm_source=flyer')
        expect(global.fetch).not.toHaveBeenCalled()
        expect(await generateMetadata(pageProps(new URL('https://peanut.me/go/shortlink'), 'shortlink'))).toEqual({
            robots: { index: false, follow: false },
        })
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('wins over a creator with the same username only on the mapped path', async () => {
        expect(location(await open('promo', '', ['flyer']))).toBe('/app')
        expect(global.fetch).not.toHaveBeenCalled()
        expect(handoff(await open('promo', '', ['ig']))).toEqual({
            app_entry: '1',
            tl: 'promo',
            acq_invite: 'promo',
            tl_s: 'ig',
        })
    })
})

describe('the creator page seam', () => {
    it('sends the control arm to the redirect with its variant and experiment', async () => {
        const slug = fresh()
        select({ variant: 'control', experimentId: 'n1', Page: null })
        const response = await open(slug, '', ['7'])
        expect(response.status).toBe(307)
        expect(handoff(response)).toEqual({
            app_entry: '1',
            tl: slug,
            acq_invite: slug,
            tl_s: '7',
            tl_v: 'control',
            tl_e: 'n1',
        })
    })

    it('renders a selected page with exactly the Contract props, and the entry for its handoff', async () => {
        const slug = fresh()
        select({ variant: 'a1', experimentId: 'n1', Page: TestPage })
        const response = await open(slug, '?utm_campaign=t', ['ig'], { referer: 'https://l.instagram.com/x' })
        expect(response.status).toBe(200)
        const [entry, boundary] = (rendered!.props as { children: ReactElement<Record<string, unknown>>[] }).children
        const ctaHref = `/home?app_entry=1&tl=${slug}&acq_invite=${slug}&tl_s=ig&utm_campaign=t&tl_r=l.instagram.com&tl_v=a1&tl_e=n1`
        // A page that fails to render still reaches its handoff; the entry stays outside, so the visit counts.
        expect(boundary.type).toBe(CreatorPageBoundary)
        expect(boundary.props.handoff).toBe(ctaHref)
        const page = boundary.props.children as ReactElement<Record<string, unknown>>
        expect(page.type).toBe(TestPage)
        expect(page.props).toEqual({
            creator: { username: slug, linkId },
            variant: 'a1',
            ctaHref,
            visit: {
                username: slug,
                placement: 'ig',
                code: null,
                utm: { source: null, medium: null, campaign: 't', content: null },
                referrerHost: 'l.instagram.com',
            },
        })
        expect(ctaHref).not.toContain('tl_seen')
        expect(entry.type).toBe(TrackedLinkEntry)
        expect(entry.props).toEqual({ handoff: ctaHref })
    })

    it('falls back to the v1 handoff without tags when parsing throws', async () => {
        jest.mocked(parseGoRequest).mockImplementationOnce(() => {
            throw new Error('parser bug')
        })
        jest.spyOn(console, 'error').mockImplementationOnce(() => {})
        const slug = fresh()
        select({ variant: 'a1', experimentId: 'n1', Page: TestPage })
        const response = await open(slug, '?utm_campaign=x', ['ig'], { referer: 'https://l.instagram.com/' })
        expect(response.status).toBe(307)
        expect(location(response)).toBe(`/home?app_entry=1&tl=${slug}&acq_invite=${slug}`)
    })

    it('falls back to the v1 handoff without tags when the page selection throws', async () => {
        jest.mocked(selectCreatorPage).mockRejectedValue(new Error('registry bug'))
        jest.spyOn(console, 'error').mockImplementationOnce(() => {})
        const slug = fresh()
        const response = await open(slug, '?utm_campaign=x', ['ig'])
        expect(response.status).toBe(307)
        expect(location(response)).toBe(`/home?app_entry=1&tl=${slug}&acq_invite=${slug}`)
    })

    it('throws on a variant outside the label pattern outside production', async () => {
        select({ variant: 'A1', experimentId: 'n1', Page: TestPage })
        await expect(open(fresh())).rejects.toThrow('invalid variant')
    })

    it('treats a variant outside the label pattern as no page in production, and logs it', async () => {
        env.NODE_ENV = 'production'
        const log = jest.spyOn(console, 'error').mockImplementationOnce(() => {})
        const slug = fresh()
        select({ variant: 'a1', experimentId: 'N_1', Page: TestPage })
        const response = await open(slug, '', ['ig'])
        expect(response.status).toBe(307)
        expect(handoff(response)).toEqual({ app_entry: '1', tl: slug, acq_invite: slug, tl_s: 'ig' })
        expect(log).toHaveBeenCalledTimes(1)
    })

    it('selects once per request for the metadata and the page, and never lets a page be indexed', async () => {
        const slug = fresh()
        select({
            variant: 'a1',
            experimentId: 'n1',
            Page: TestPage,
            metadata: { title: 'Nita', robots: { index: true, follow: true } },
        })
        newRequest()
        const request = new Request(`https://peanut.me/go/${slug}`)
        const metadata = await generateMetadata(pageProps(new URL(request.url), slug))
        expect((await go(request, slug, undefined, true)).status).toBe(200)
        expect(selectCreatorPage).toHaveBeenCalledTimes(1)
        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(metadata).toEqual({ title: 'Nita', robots: { index: false, follow: false } })
    })

    it('keeps a creator without a page out of the index too', async () => {
        const slug = fresh()
        newRequest()
        const metadata = await generateMetadata(pageProps(new URL(`https://peanut.me/go/${slug}`), slug))
        expect(metadata).toEqual({ robots: { index: false, follow: false } })
    })
})
