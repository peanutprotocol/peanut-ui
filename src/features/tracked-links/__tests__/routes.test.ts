/** @jest-environment node */
import { GET as go } from '@/app/go/[slug]/[[...rest]]/route'
import { GO_PLACEMENTS, parseGoRequest } from '@/features/tracked-links/contract'

jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.example.test' }))
jest.mock('@/features/tracked-links/contract', () => {
    const actual = jest.requireActual('@/features/tracked-links/contract')
    return { ...actual, parseGoRequest: jest.fn(actual.parseGoRequest) }
})
const originalFetch = global.fetch
const linkId = `invite_${'a'.repeat(64)}`
const context = (slug: string, rest?: string[]) => ({ params: Promise.resolve({ slug, rest }) })
const open = (slug: string, query = '', rest?: string[], headers?: Record<string, string>) =>
    go(
        new Request(`https://peanut.me/go/${[slug, ...(rest ?? [])].join('/')}${query}`, { headers }),
        context(slug, rest)
    )
const location = (response: Response) => response.headers.get('location')
const handoff = (response: Response) =>
    Object.fromEntries(new URL(location(response)!, 'https://peanut.me').searchParams)
// The lookup cache is module state; a fresh slug per test keeps each lookup observable.
let n = 0
const fresh = () => `creator${n++}`
const linkNotFound = () => Response.json({ error: 'Link not found' }, { status: 404 })

beforeEach(() => {
    jest.useRealTimers()
    global.fetch = jest.fn().mockResolvedValue(Response.json({ linkId }))
})
afterAll(() => {
    global.fetch = originalFetch
})

it('hands a known creator to the app entry, dropping every incoming query parameter', async () => {
    const slug = fresh()
    const response = await open(slug, '?invite=mallory&dest=https://evil.test&fbclid=secret')
    expect(response.status).toBe(307)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const target = new URL(location(response)!, 'https://peanut.me')
    expect(target.pathname).toBe('/home')
    expect(Object.fromEntries(target.searchParams)).toEqual({ app_entry: '1', tl: slug, acq_invite: slug })
    expect(global.fetch).toHaveBeenCalledWith(
        `https://api.example.test/tracked-links/invites/${slug}`,
        expect.objectContaining({ redirect: 'error', headers: { Accept: 'application/json' } })
    )
})

it('hands a capitalised username and placement straight to the lowercase creator, without a 308', async () => {
    const slug = fresh()
    const response = await open(slug.replace('creator', 'Creator'), '', ['IG'])
    expect(response.status).toBe(307)
    expect(handoff(response)).toEqual({ app_entry: '1', tl: slug, acq_invite: slug, tl_s: 'ig' })
    expect(global.fetch).toHaveBeenCalledWith(
        `https://api.example.test/tracked-links/invites/${slug}`,
        expect.anything()
    )
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
    expect(response.status).toBe(307)
    expect(handoff(response)).toEqual({ app_entry: '1', tl: slug, acq_invite: slug, utm_source: 'first' })
})

it.each([
    'utm_campaign=https%3A%2F%2Fevil.test',
    'utm_campaign=123e4567-e89b-42d3-a456-426614174000',
    'fbclid=x&utm_term=y&tl=mallory&acq_invite=mallory&invite=mallory&code=mallory&badge_campaign=nita',
])('never carries %s into the handoff', async (query) => {
    const slug = fresh()
    expect(handoff(await open(slug, `?${query}`))).toEqual({ app_entry: '1', tl: slug, acq_invite: slug })
})

it('carries the allowlisted tags together', async () => {
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

it('falls back to the v1 handoff without tags when parsing throws', async () => {
    jest.mocked(parseGoRequest).mockImplementationOnce(() => {
        throw new Error('parser bug')
    })
    const slug = fresh()
    const response = await open(slug, '?utm_campaign=x', ['ig'], { referer: 'https://l.instagram.com/' })
    expect(response.status).toBe(307)
    expect(location(response)).toBe(`/home?app_entry=1&tl=${slug}&acq_invite=${slug}`)
})

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
                    { message: 'Route GET:/tracked-links/invites/x not found', error: 'Not Found', statusCode: 404 },
                    { status: 404 }
                )
            ),
    ],
    ['an empty 404', () => Promise.resolve(new Response(null, { status: 404 }))],
])('falls back to the plain store entry without attribution on %s', async (_case, reply) => {
    jest.mocked(global.fetch).mockImplementation(reply)
    const response = await open(fresh())
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

    const notDeployed = fresh()
    jest.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 404 }))
    await open(notDeployed)
    jest.mocked(global.fetch).mockResolvedValue(Response.json({ linkId }))
    expect(location(await open(notDeployed))).toContain('acq_invite=')
    expect(global.fetch).toHaveBeenCalledTimes(7)
})
