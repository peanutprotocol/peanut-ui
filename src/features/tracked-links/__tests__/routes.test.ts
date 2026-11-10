/** @jest-environment node */
import { GET as go, HEAD } from '@/app/go/[slug]/route'
import { GET as metadata, OPTIONS } from '@/app/api/tracked-links/resolve/[slug]/route'
import { resolveAcquisitionLink } from '../server'
import { resolveRegisteredAcquisitionLink } from '../registry'
import type { ResolvedAcquisitionLink } from '../contract'

jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.example.test' }))
jest.mock('../registry', () => ({ resolveRegisteredAcquisitionLink: jest.fn() }))
const registered = jest.mocked(resolveRegisteredAcquisitionLink)
const originalFetch = global.fetch
const context = (slug = 'alice') => ({ params: Promise.resolve({ slug }) })
const identity = { schemaVersion: 1, username: 'alice', linkId: `invite_${'a'.repeat(64)}` }
const campaign: ResolvedAcquisitionLink = {
    schemaVersion: 1,
    linkId: 'campaign_launch',
    slug: 'c-launch',
    revision: 2,
    status: 'active',
    kind: 'campaign',
    policy: 'journey',
    destination: { key: 'app-entry', continuation: '/home' },
    campaign: { source: 'creator-placement', medium: 'cpc', campaign: 'launch' },
}
beforeEach(() => {
    registered.mockReset().mockReturnValue(null)
    global.fetch = jest.fn().mockResolvedValue(Response.json(identity))
})
afterAll(() => {
    global.fetch = originalFetch
})
it('resolves only exact, active identity without forwarding request context', async () => {
    const response = await metadata(
        new Request('https://peanut.me/api/tracked-links/resolve/alice', {
            headers: { cookie: 'private', authorization: 'private', referer: 'https://private.example.test' },
        }),
        context()
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
        slug: 'alice',
        invite: { code: 'alice' },
        linkId: identity.linkId,
        policy: 'journey',
    })
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.test/tracked-links/invites/alice',
        expect.objectContaining({
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
        })
    )
})
it('drops owner, destination, revision and click-ID query injection on navigation', async () => {
    const response = await go(
        new Request('https://peanut.me/go/alice?invite=mallory&dest=https://evil.test&tr=99&fbclid=secret'),
        context()
    )
    expect(response.status).toBe(307)
    const target = new URL(response.headers.get('location')!, 'https://peanut.me')
    expect(target.pathname).toBe('/home')
    expect(Object.fromEntries(target.searchParams)).toEqual({
        app_entry: '1',
        tl: 'alice',
        tr: '1',
        acq_invite: 'alice',
    })
})
it.each([404, 503])('maps identity failure %i without claiming attribution', async (status) => {
    jest.mocked(global.fetch).mockResolvedValue(new Response(null, { status }))
    const response = await go(new Request('https://peanut.me/go/alice'), context())
    expect(response.status).toBe(status === 503 ? 307 : 404)
    expect(response.headers.get('location')).toBe(status === 503 ? '/home?app_entry=1' : null)
})
it('fails malformed and mismatched identity closed', async () => {
    jest.mocked(global.fetch).mockResolvedValue(Response.json({ ...identity, username: 'mallory' }))
    expect(await resolveAcquisitionLink('alice')).toEqual({ status: 503 })
    expect(await resolveAcquisitionLink('../alice')).toEqual({ status: 400 })
})
it('uses current registered revision for navigation and historical revision only for metadata', async () => {
    registered.mockReturnValue(campaign)
    const response = await go(new Request('https://peanut.me/go/c-launch?tr=1&utm_source=evil'), context('c-launch'))
    expect(registered).toHaveBeenCalledWith('c-launch', undefined)
    expect(new URL(response.headers.get('location')!, 'https://peanut.me').searchParams.get('utm_source')).toBe(
        'creator-placement'
    )
    await metadata(new Request('https://peanut.me/api/tracked-links/resolve/c-launch?revision=1'), context('c-launch'))
    expect(registered).toHaveBeenLastCalledWith('c-launch', 1)
    expect(global.fetch).not.toHaveBeenCalled()
})
it('does not return an active creator campaign for an inactive inviter', async () => {
    registered.mockImplementation((slug) => (slug === 'c-launch' ? { ...campaign, invite: { code: 'alice' } } : null))
    jest.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 404 }))
    expect(await resolveAcquisitionLink('c-launch')).toEqual({ status: 404 })
})
it('keeps retired aliases reserved and marketing QR on the existing personless transport', async () => {
    registered.mockReturnValue({ ...campaign, status: 'retired' })
    expect((await go(new Request('https://peanut.me/go/c-launch'), context('c-launch'))).status).toBe(410)
    registered.mockReturnValue({
        ...campaign,
        slug: 'qr-home-hero-en',
        kind: 'marketing_qr',
        invite: undefined,
        policy: 'personless',
        qr: { id: 'home-hero-en' },
    })
    expect(
        (await go(new Request('https://peanut.me/go/qr-home-hero-en'), context('qr-home-hero-en'))).headers.get(
            'location'
        )
    ).toBe('/home?mqr=home-hero-en')
})
it('metadata refuses duplicate or arbitrary parameters and supports only known native origins', async () => {
    expect(
        (
            await metadata(
                new Request('https://peanut.me/api/tracked-links/resolve/alice?revision=1&revision=2'),
                context()
            )
        ).status
    ).toBe(400)
    expect(
        (await metadata(new Request('https://peanut.me/api/tracked-links/resolve/alice?dest=/send'), context())).status
    ).toBe(400)
    const response = await metadata(
        new Request('https://peanut.me/api/tracked-links/resolve/alice', {
            headers: { origin: 'capacitor://localhost' },
        }),
        context()
    )
    expect(response.headers.get('access-control-allow-origin')).toBe('capacitor://localhost')
    expect(
        OPTIONS(
            new Request('https://peanut.me/api/tracked-links/resolve/alice', {
                headers: { origin: 'https://evil.test' },
            })
        ).status
    ).toBe(403)
    expect((await HEAD(new Request('https://peanut.me/go/alice'), context())).body).toBeNull()
})
