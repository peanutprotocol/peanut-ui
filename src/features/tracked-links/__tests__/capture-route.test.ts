/** @jest-environment node */
import { after } from 'next/server'
import { POST, OPTIONS, GET } from '@/app/api/tracked-links/open/route'
import { captureTrackedLinkOpening } from '../capture-server'
import type { AcquisitionLinkResolution, ResolvedAcquisitionLink } from '../contract'

const mockResolve = jest.fn<Promise<AcquisitionLinkResolution>, [string, number?]>()
jest.mock('next/server', () => ({ after: jest.fn() }))
jest.mock('../capture-server', () => ({
    ...jest.requireActual('../capture-server'),
    captureTrackedLinkOpening: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/features/tracked-links/server', () => ({
    resolveAcquisitionLink: (...args: [string, number?]) => mockResolve(...args),
}))

const link: ResolvedAcquisitionLink = {
    schemaVersion: 1,
    linkId: 'campaign_launch',
    slug: 'launch-campaign',
    revision: 1,
    kind: 'campaign',
    status: 'active',
    policy: 'journey',
    destination: { key: 'app-entry', continuation: '/home' },
    campaign: { source: 'twitter', medium: 'social', campaign: 'launch' },
}
const opening = () => ({
    event_id: '11111111-1111-4111-8111-111111111111',
    opened_at: new Date().toISOString(),
    signup_journey_id: '22222222-2222-4222-8222-222222222222',
    slug: link.slug,
    revision: 1,
})
const request = (body: unknown = opening(), headers: Record<string, string> = {}) =>
    new Request('https://peanut.me/api/tracked-links/open', {
        method: 'POST',
        headers: { origin: 'https://peanut.me', 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
    })
const tasks: Array<() => unknown> = []
beforeEach(() => {
    jest.clearAllMocks()
    tasks.length = 0
    mockResolve.mockResolvedValue({ status: 200, link })
    jest.mocked(after).mockImplementation((task) => {
        if (typeof task === 'function') tasks.push(task)
    })
})

it('acknowledges acceptance before upstream work and derives the registered revision', async () => {
    const body = opening()
    const result = await POST(
        request(body, {
            cookie: 'private-cookie',
            authorization: 'private-token',
            referer: 'https://private.test/account',
        })
    )
    expect(result.status).toBe(204)
    expect(result.headers.get('cache-control')).toContain('no-store')
    expect(mockResolve).toHaveBeenCalledWith(link.slug, link.revision)
    expect(captureTrackedLinkOpening).not.toHaveBeenCalled()
    await tasks[0]()
    expect(captureTrackedLinkOpening).toHaveBeenCalledWith(body, link, 'https://peanut.me', 'web')
    expect(JSON.stringify(jest.mocked(captureTrackedLinkOpening).mock.calls)).not.toMatch(/private/)
})
it.each(['capacitor://localhost', 'https://localhost'])('accepts only a known native origin: %s', async (origin) => {
    const result = await POST(request(opening(), { origin }))
    expect(result.status).toBe(204)
    expect(result.headers.get('access-control-allow-origin')).toBe(origin)
    expect(result.headers.get('access-control-allow-credentials')).toBeNull()
    await tasks[0]()
    expect(captureTrackedLinkOpening).toHaveBeenCalledWith(expect.anything(), link, 'https://peanut.me', 'app')
    expect(OPTIONS(request(opening(), { origin })).status).toBe(204)
})
it('rejects foreign origins, unknown fields and oversized streamed bodies before resolution', async () => {
    expect((await POST(request(opening(), { origin: 'https://outside.test' }))).status).toBe(403)
    expect((await POST(request({ ...opening(), userId: 'private' }))).status).toBe(400)
    expect((await POST(request('x'.repeat(1025)))).status).toBe(413)
    expect(mockResolve).not.toHaveBeenCalled()
    expect(GET().status).toBe(405)
    expect(OPTIONS(request(opening(), { origin: 'https://outside.test' })).status).toBe(405)
})
it.each<Record<string, string>>([
    { dnt: '1' },
    { 'sec-gpc': '1' },
    { 'user-agent': 'facebookexternalhit/1.1' },
    { 'sec-purpose': 'prefetch;prerender' },
])('does not resolve or capture denied/automated ingress %o', async (headers) => {
    expect((await POST(request(opening(), headers))).status).toBe(204)
    expect(mockResolve).not.toHaveBeenCalled()
    expect(tasks).toHaveLength(0)
})
it.each([404, 410, 503] as const)('returns resolver status %s without scheduling an event', async (status) => {
    mockResolve.mockResolvedValue({ status })
    expect((await POST(request())).status).toBe(status)
    expect(tasks).toHaveLength(0)
})
it('does not admit a personless QR through the journey endpoint', async () => {
    mockResolve.mockResolvedValue({
        status: 200,
        link: { ...link, kind: 'marketing_qr', policy: 'personless', qr: { id: 'home-hero-en' } },
    })
    expect((await POST(request())).status).toBe(400)
    expect(tasks).toHaveLength(0)
})
