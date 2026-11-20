/** @jest-environment node */
import { after } from 'next/server'
import { POST, OPTIONS, GET } from '@/app/api/tracked-links/open/route'
import type { SignupAttributionContext } from '@/utils/signup-attribution'
import { captureTrackedLinkVisit, parseTrackedLinkOpening } from '../capture'
import { bareGoVisit } from '../contract'

jest.mock('next/server', () => ({ after: jest.fn() }))
jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.example.test' }))
jest.mock('@/utils/posthog-setup', () => ({ isAnalyticsCaptureBuild: () => true }))

const linkId = `invite_${'a'.repeat(64)}`
const journey = {
    journeyId: '22222222-2222-4222-8222-222222222222',
} as SignupAttributionContext
// The lookup cache and the visit dedupe are module state; each test uses its own slug.
let n = 0
let slug = ''
const opening = () => ({
    event_id: '11111111-1111-4111-8111-111111111111',
    opened_at: new Date().toISOString(),
    signup_journey_id: journey.journeyId,
    slug,
})
const NO_LABELS = {
    placement: null,
    code: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    referrer_host: null,
    page_variant: null,
    page_experiment: null,
}
// One path segment carries a placement or a code, never both.
const LABELS = {
    placement: 'ig',
    code: null,
    utm_source: 'meta',
    utm_medium: 'cpc',
    utm_campaign: 'ar-push',
    utm_content: 'reel 2',
    referrer_host: 'l.instagram.com',
    page_variant: 'a1',
    page_experiment: 'nita-2026-11-a',
}
const request = (body: unknown = opening(), headers: Record<string, string> = {}) =>
    new Request('https://peanut.me/api/tracked-links/open', {
        method: 'POST',
        headers: { origin: 'https://peanut.me', 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
    })
const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>()
const posthogBodies = () =>
    fetchMock.mock.calls
        .filter(([url]) => url === 'https://eu.i.posthog.com/i/v0/e/')
        .map(([, init]) => JSON.parse(init!.body as string))
const lookups = () => fetchMock.mock.calls.filter(([url]) => url.startsWith('https://api.example.test')).length
const tasks: Array<() => unknown> = []
const runTasks = () => Promise.all(tasks.map((task) => task()))
const saved = { key: process.env.NEXT_PUBLIC_POSTHOG_KEY, env: process.env.VERCEL_ENV }

beforeEach(() => {
    slug = `creator${n++}`
    tasks.length = 0
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-project-key'
    process.env.VERCEL_ENV = 'production'
    fetchMock
        .mockReset()
        .mockImplementation(async (url) =>
            url.startsWith('https://api.example.test') ? Response.json({ linkId }) : new Response(null, { status: 200 })
        )
    global.fetch = fetchMock as unknown as typeof fetch
    jest.mocked(after).mockImplementation((task) => {
        if (typeof task === 'function') tasks.push(task)
    })
})
afterAll(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = saved.key
    process.env.VERCEL_ENV = saved.env
})

describe('open route', () => {
    it('answers before upstream work and sends a personless event with the server-derived link ID', async () => {
        const body = opening()
        const response = await POST(
            request(body, { cookie: 'private-cookie', authorization: 'private-token', referer: 'https://private.test' })
        )
        expect(response.status).toBe(204)
        expect(response.headers.get('cache-control')).toContain('no-store')
        expect(posthogBodies()).toHaveLength(0)
        await runTasks()
        expect(posthogBodies()).toEqual([
            {
                api_key: 'test-project-key',
                uuid: body.event_id,
                timestamp: body.opened_at,
                event: 'tracked_link_visit',
                distinct_id: `tracked-link:${body.event_id}`,
                properties: {
                    schema_version: 2,
                    link_id: linkId,
                    signup_journey_id: body.signup_journey_id,
                    opened_in: 'web',
                    ...NO_LABELS,
                    $process_person_profile: false,
                    $geoip_disable: true,
                },
            },
        ])
        expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(/private/)
    })

    it.each(['capacitor://localhost', 'https://localhost'])('accepts a known app origin: %s', async (origin) => {
        const response = await POST(request(opening(), { origin }))
        expect(response.status).toBe(204)
        expect(response.headers.get('access-control-allow-origin')).toBe(origin)
        expect(response.headers.get('access-control-allow-credentials')).toBeNull()
        await runTasks()
        expect(posthogBodies()[0].properties.opened_in).toBe('app')
        expect(OPTIONS(request(opening(), { origin })).status).toBe(204)
    })

    it('rejects foreign origins, unknown fields and oversized bodies before any lookup', async () => {
        expect((await POST(request(opening(), { origin: 'https://outside.test' }))).status).toBe(403)
        expect((await POST(request({ ...opening(), userId: 'private' }))).status).toBe(400)
        expect((await POST(request('x'.repeat(1025)))).status).toBe(413)
        expect(lookups()).toBe(0)
        expect(GET().status).toBe(405)
        expect(OPTIONS(request(opening(), { origin: 'https://outside.test' })).status).toBe(405)
    })

    it.each<Record<string, string>>([
        { dnt: '1' },
        { 'sec-gpc': '1' },
        { 'user-agent': 'facebookexternalhit/1.1' },
        { 'sec-purpose': 'prefetch;prerender' },
    ])('neither looks up nor captures denied or automated ingress %o', async (headers) => {
        expect((await POST(request(opening(), headers))).status).toBe(204)
        expect(lookups()).toBe(0)
        expect(tasks).toHaveLength(0)
    })

    it.each([
        ["the route's own 404", () => Response.json({ error: 'Link not found' }, { status: 404 }), 404],
        ['a generic 404', () => new Response(null, { status: 404 }), 503],
        ['a 503', () => new Response(null, { status: 503 }), 503],
    ])('maps an identity answer of %s to %i without an event', async (_case, upstream, status) => {
        fetchMock.mockImplementation(async () => upstream())
        expect((await POST(request())).status).toBe(status)
        expect(tasks).toHaveLength(0)
    })

    it("records an alias opening against the company inviter's fixed link ID, without a lookup", async () => {
        const body = { ...opening(), slug: 'squirrel', code: 1, utm_medium: 'cpm', utm_campaign: 'palermo' }
        expect((await POST(request(body))).status).toBe(204)
        await runTasks()
        expect(lookups()).toBe(0)
        expect(posthogBodies()[0].properties).toMatchObject({
            link_id: 'invite_4248470e96e8e07697e694852f03b3f4025ebfb354e5615cb8152eb56c9be0bf',
            code: 1,
            utm_medium: 'cpm',
            utm_campaign: 'palermo',
        })
    })

    it.each(['preview', 'development'])('does not forward events from %s', async (deployment) => {
        process.env.VERCEL_ENV = deployment
        await POST(request())
        await runTasks()
        expect(posthogBodies()).toHaveLength(0)
    })

    it('does not forward events a production deployment serves on another origin', async () => {
        const origin = 'https://peanut-ui-git-feature.vercel.app'
        const response = await POST(
            new Request(`${origin}/api/tracked-links/open`, {
                method: 'POST',
                headers: { origin, 'content-type': 'application/json' },
                body: JSON.stringify(opening()),
            })
        )
        expect(response.status).toBe(204)
        await runTasks()
        expect(posthogBodies()).toHaveLength(0)
    })
})

describe('visit v2 labels', () => {
    it('forwards every label exactly', async () => {
        expect((await POST(request({ ...opening(), ...LABELS }))).status).toBe(204)
        await runTasks()
        expect(posthogBodies()[0].properties).toEqual({
            schema_version: 2,
            link_id: linkId,
            signup_journey_id: journey.journeyId,
            opened_in: 'web',
            ...LABELS,
            $process_person_profile: false,
            $geoip_disable: true,
        })
    })

    it('stores a bad label as null and still sends the event', async () => {
        const bad = {
            placement: 'zz',
            code: 0,
            utm_source: 'a@b.com',
            utm_medium: 'banner',
            utm_campaign: 'x'.repeat(65),
            utm_content: 7,
            referrer_host: 'localhost',
            page_variant: 'A1',
            page_experiment: 'https://evil.test',
        }
        expect((await POST(request({ ...opening(), ...bad }))).status).toBe(204)
        await runTasks()
        expect(posthogBodies()[0].properties).toMatchObject(NO_LABELS)
    })

    it.each([
        ['code', '7'],
        ['code', 1.5],
        ['placement', 'constructor'],
    ])('treats %s %p as no label', (key, value) => {
        expect(parseTrackedLinkOpening({ ...opening(), [key]: value })).toMatchObject({ [key]: null })
    })

    it('fits the worst-case body under the 1,024-byte cap', async () => {
        const worst = {
            ...opening(),
            slug: 'a'.repeat(64),
            placement: 'ig',
            code: 9999,
            utm_source: 'a'.repeat(64),
            utm_medium: 'ambassador',
            utm_campaign: 'a'.repeat(64),
            utm_content: 'a'.repeat(64),
            referrer_host: `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`,
            page_variant: 'a'.repeat(32),
            page_experiment: 'a'.repeat(32),
        }
        expect(new TextEncoder().encode(JSON.stringify(worst)).length).toBeLessThan(1024)
        expect(parseTrackedLinkOpening(worst)).toMatchObject({ referrer_host: worst.referrer_host })
        expect((await POST(request(worst))).status).toBe(204)
    })
})

describe('opening body', () => {
    it.each(['userId', 'linkId', 'utm_term', 'raw_url', 'referrer', 'gclid', 'distinct_id', 'username'])(
        'rejects untrusted client field %s',
        (field) => expect(parseTrackedLinkOpening({ ...opening(), [field]: 'private' })).toBeNull()
    )
    it('requires a fresh timestamp, a username slug and a journey UUID', () => {
        expect(parseTrackedLinkOpening(opening())).not.toBeNull()
        expect(
            parseTrackedLinkOpening({ ...opening(), opened_at: new Date(Date.now() - 300_001).toISOString() })
        ).toBeNull()
        expect(parseTrackedLinkOpening({ ...opening(), slug: 'Alice' })).toBeNull()
        expect(parseTrackedLinkOpening({ ...opening(), signup_journey_id: 'user-123' })).toBeNull()
    })
})

describe('visit sender', () => {
    it('sends one keepalive browser opening per slug per page render, in the shape the route accepts', () => {
        captureTrackedLinkVisit(slug, { openedIn: 'web', seen: false, journey })
        captureTrackedLinkVisit(slug, { openedIn: 'web', seen: false, journey })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/api/tracked-links/open')
        expect(init).toMatchObject({ method: 'POST', credentials: 'omit', keepalive: true })
        expect(parseTrackedLinkOpening(JSON.parse(init!.body as string))).toMatchObject({
            slug,
            signup_journey_id: journey.journeyId,
            ...NO_LABELS,
        })
    })

    it('sends the visit labels in the shape the route accepts', () => {
        const visit = {
            ...bareGoVisit(slug),
            code: 7,
            utm: { source: 'meta', medium: 'cpc', campaign: 'ar-push', content: null },
            referrerHost: 'l.instagram.com',
        }
        captureTrackedLinkVisit(slug, { openedIn: 'web', seen: false, journey, visit })
        expect(parseTrackedLinkOpening(JSON.parse(fetchMock.mock.calls[0][1]!.body as string))).toMatchObject({
            placement: null,
            code: 7,
            utm_source: 'meta',
            utm_medium: 'cpc',
            utm_campaign: 'ar-push',
            utm_content: null,
            referrer_host: 'l.instagram.com',
        })
    })

    it('counts a later opening of the same link in the same app session', () => {
        const now = jest.spyOn(Date, 'now')
        try {
            now.mockReturnValue(1_000_000)
            captureTrackedLinkVisit('later', { openedIn: 'app', seen: false, journey })
            now.mockReturnValue(1_002_999)
            captureTrackedLinkVisit('later', { openedIn: 'app', seen: false, journey })
            expect(fetchMock).toHaveBeenCalledTimes(1)
            now.mockReturnValue(1_003_000)
            captureTrackedLinkVisit('later', { openedIn: 'app', seen: false, journey })
            expect(fetchMock).toHaveBeenCalledTimes(2)
        } finally {
            now.mockRestore()
        }
    })

    it('posts a direct app opening to the web origin without keepalive', () => {
        captureTrackedLinkVisit(slug, { openedIn: 'app', seen: false, journey })
        expect(fetchMock.mock.calls[0][0]).toBe('https://peanut.me/api/tracked-links/open')
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ keepalive: false })
    })

    it('sends nothing for a browser-to-app continuation or without a consented journey', () => {
        captureTrackedLinkVisit(slug, { openedIn: 'app', seen: true, journey })
        captureTrackedLinkVisit(slug, { openedIn: 'web', seen: false, journey: null })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
