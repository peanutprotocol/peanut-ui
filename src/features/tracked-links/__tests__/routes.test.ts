/** @jest-environment node */
import { GET as go } from '@/app/go/[slug]/route'

jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.example.test' }))
const originalFetch = global.fetch
const linkId = `invite_${'a'.repeat(64)}`
const context = (slug: string) => ({ params: Promise.resolve({ slug }) })
const open = (slug: string, query = '') => go(new Request(`https://peanut.me/go/${slug}${query}`), context(slug))
const location = (response: Response) => response.headers.get('location')
// The lookup cache is module state; a fresh slug per test keeps each lookup observable.
let n = 0
const fresh = () => `creator${n++}`

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

it('redirects a capitalised username to its lowercase URL before any lookup', async () => {
    const response = await open('Konrad', '?utm_source=x')
    expect(response.status).toBe(308)
    expect(location(response)).toBe('/go/konrad')
    expect(global.fetch).not.toHaveBeenCalled()
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
    jest.mocked(global.fetch).mockResolvedValue(Response.json({ error: 'Link not found' }, { status: 404 }))
    const response = await open(fresh())
    expect(response.status).toBe(404)
    expect(location(response)).toBeNull()
})

it.each([
    ['a 5xx', () => Promise.resolve(new Response(null, { status: 503 }))],
    ['a timeout', () => Promise.reject(new DOMException('timed out', 'TimeoutError'))],
    ['a malformed body', () => Promise.resolve(Response.json({ username: 'alice' }))],
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
    jest.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 404 }))
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
