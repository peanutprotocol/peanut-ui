/** @jest-environment node */
import { after } from 'next/server'
import { POST, OPTIONS, GET } from '@/app/api/tracked-links/open/route'
import type { SignupAttributionContext } from '@/utils/signup-attribution'
import { captureTrackedLinkVisit, parseTrackedLinkOpening } from '../capture'

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
                    schema_version: 1,
                    link_id: linkId,
                    signup_journey_id: body.signup_journey_id,
                    opened_in: 'web',
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

describe('opening body', () => {
    it.each(['userId', 'linkId', 'utm_source', 'raw_url', 'referrer', 'gclid', 'distinct_id'])(
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
    it('sends one keepalive browser opening per slug per page load, in the shape the route accepts', () => {
        captureTrackedLinkVisit(slug, { openedIn: 'web', seen: false, journey })
        captureTrackedLinkVisit(slug, { openedIn: 'web', seen: false, journey })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/api/tracked-links/open')
        expect(init).toMatchObject({ method: 'POST', credentials: 'omit', keepalive: true })
        expect(parseTrackedLinkOpening(JSON.parse(init!.body as string))).toMatchObject({
            slug,
            signup_journey_id: journey.journeyId,
        })
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
