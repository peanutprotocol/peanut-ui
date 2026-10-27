/** @jest-environment node */
import { after } from 'next/server'
import { POST, GET as captureGet } from '@/app/api/marketing-qr/open/route'
import { GET, HEAD } from '@/app/q/[placement]/route'

jest.mock('next/server', () => ({ after: jest.fn() }))
const originalEnv = {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    deployment: process.env.VERCEL_ENV,
}
const originalFetch = global.fetch
const tasks: Array<() => unknown> = []
const eventId = 'ce3055cb-9106-48ef-9c7c-098211fa3e3c'
const payload = () => ({
    event_id: eventId,
    opened_at: new Date().toISOString(),
    qr_id: 'home-hero-en',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'launch',
    attribution_origin: 'current_url',
    attribution_adjustment: 'none',
})
const request = (value: unknown = payload(), headers: Record<string, string> = {}, origin = 'https://peanut.me') =>
    new Request(`${origin}/api/marketing-qr/open`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json', ...headers },
        body: typeof value === 'string' ? value : JSON.stringify(value),
    })
const context = { params: Promise.resolve({ placement: 'home-hero-en' }) }
beforeEach(() => {
    tasks.length = 0
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-project-token'
    process.env.VERCEL_ENV = 'production'
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }))
    jest.mocked(after).mockImplementation((task) => {
        if (typeof task === 'function') tasks.push(task)
    })
})
afterAll(() => {
    global.fetch = originalFetch
    for (const [name, value] of Object.entries({
        NEXT_PUBLIC_POSTHOG_KEY: originalEnv.key,
        VERCEL_ENV: originalEnv.deployment,
    })) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
    }
})

it('returns before capture and sends only the stable, anonymous allowlisted event', async () => {
    const body = payload()
    const response = await POST(
        request(body, {
            cookie: 'jwt-token=private',
            authorization: 'private',
            'x-forwarded-for': '192.0.2.1',
            'user-agent': 'customer-browser',
            referer: 'https://private.example/account',
        })
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(global.fetch).not.toHaveBeenCalled()
    await tasks[0]()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = jest.mocked(global.fetch).mock.calls[0]
    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    const sent = JSON.parse(init!.body as string)
    expect(sent).toMatchObject({
        uuid: eventId,
        timestamp: body.opened_at,
        event: 'marketing_qr_opened',
        distinct_id: `marketing-qr:${eventId}`,
        properties: {
            schema_version: 1,
            qr_id: 'home-hero-en',
            page_id: '/',
            surface_type: 'landing',
            placement: 'hero',
            locale: 'en',
            destination_key: 'app-entry',
            $process_person_profile: false,
            $geoip_disable: true,
        },
    })
    expect(JSON.stringify(sent)).not.toMatch(/private|192\.0\.2|customer-browser|\$ip|\$set/)
    await tasks[0]()
    expect(jest.mocked(global.fetch).mock.calls[1][1]?.body).toBe(init?.body)
})

it.each([
    ['NEXT_PUBLIC_POSTHOG_KEY', ''],
    ['VERCEL_ENV', 'preview'],
    ['VERCEL_ENV', 'development'],
])('never sends from an ineligible environment: %s=%s', async (key, value) => {
    process.env[key] = value
    expect((await POST(request())).status).toBe(204)
    await tasks[0]()
    expect(global.fetch).not.toHaveBeenCalled()
})

it('accepts the local browser envelope without enabling production transport', async () => {
    expect((await POST(request(payload(), {}, 'http://localhost:8777'))).status).toBe(204)
    await tasks[0]()
    expect(global.fetch).not.toHaveBeenCalled()
})

it.each(['https://evil.example', 'null', 'https://peanut.me.evil.example', ''])(
    'rejects a disallowed Origin %s',
    async (origin) => {
        expect((await POST(request(payload(), { origin }))).status).toBe(403)
        expect(tasks).toHaveLength(0)
    }
)

it.each([
    { user_id: 'person' },
    { qr_id: 'send-person' },
    { event_id: 'person' },
    { opened_at: 'invalid' },
    { opened_at: new Date(Date.now() - 600_000).toISOString() },
    { opened_at: new Date(Date.now() + 120_000).toISOString() },
    { utm_campaign: 'user@example.com' },
    { utm_source: 42 },
    { attribution_origin: 'invented' },
])('rejects malformed, unknown or identifying event fields %j', async (changes) => {
    expect((await POST(request({ ...payload(), ...changes }))).status).toBe(400)
    expect(tasks).toHaveLength(0)
})

it('enforces the actual body length without trusting Content-Length', async () => {
    expect((await POST(request('x'.repeat(1025)))).status).toBe(413)
    expect((await POST(request(payload(), { 'content-length': '1025' }))).status).toBe(413)
    expect((await POST(request('{broken'))).status).toBe(400)
    expect((await POST(request(payload(), { 'content-type': 'text/plain' }))).status).toBe(400)
    expect(captureGet().status).toBe(405)
    expect(tasks).toHaveLength(0)
})

it.each<Record<string, string>>([
    { 'user-agent': 'Googlebot' },
    { 'sec-purpose': 'prefetch' },
    { dnt: '1' },
    { 'sec-gpc': '1' },
])('does not capture automation or privacy-denied requests %j', async (headers) => {
    expect((await POST(request(payload(), headers))).status).toBe(204)
    expect(tasks).toHaveLength(0)
})

it('contains capture failures after the successful browser response', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new Error('offline'))
    expect((await POST(request())).status).toBe(204)
    await expect(tasks[0]()).resolves.toBeUndefined()
})

it('serves a standalone nonce-protected handoff without capturing a GET or HEAD', async () => {
    const response = await GET(new Request('https://peanut.me/q/home-hero-en'), context)
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toMatch(/script-src 'nonce-[^']+'/)
    expect(html).toContain('Get the Peanut app')
    expect(html).toContain('https://apps.apple.com/us/app/id6786373552')
    expect(html).not.toContain('/_next/')
    expect(html).not.toContain('posthog.init')
    expect((await HEAD(new Request('https://peanut.me/q/home-hero-en'), context)).status).toBe(200)
    expect(tasks).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
})

it('keeps malformed registered links navigable without exporting their input', async () => {
    const response = await GET(
        new Request('https://peanut.me/q/home-hero-en?url=https://evil.example&wid=secret-person'),
        context
    )
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('"captureEnabled":false')
    expect(html).not.toMatch(/evil\.example|secret-person/)
    expect(
        (await GET(new Request('https://peanut.me/q/missing'), { params: Promise.resolve({ placement: 'missing' }) }))
            .status
    ).toBe(404)
    expect((await GET(new Request(`https://peanut.me/q/home-hero-en?c=${'x'.repeat(2100)}`), context)).status).toBe(414)
})
