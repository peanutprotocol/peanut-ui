/** @jest-environment node */
import { captureTrackedLinkOpening, parseTrackedLinkOpening } from '../capture-server'
import { captureMarketingQrOpening, parseMarketingQrOpening } from '@/features/marketing-qr/server'
import type { ResolvedAcquisitionLink } from '../contract'

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
const originalFetch = global.fetch
const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const originalDeployment = process.env.VERCEL_ENV
beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-project-key'
    process.env.VERCEL_ENV = 'production'
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }))
    jest.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey
    if (originalDeployment === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalDeployment
})

it.each(['userId', 'policy', 'utm_source', 'raw_url', 'referrer', 'gclid', 'distinct_id'])(
    'rejects untrusted client field %s',
    (field) => {
        expect(parseTrackedLinkOpening({ ...opening(), [field]: 'private' })).toBeNull()
    }
)
it('requires a bounded valid timestamp, revision and journey', () => {
    expect(parseTrackedLinkOpening(opening())).not.toBeNull()
    expect(parseTrackedLinkOpening({ ...opening(), opened_at: new Date(Date.now() - 300001).toISOString() })).toBeNull()
    expect(parseTrackedLinkOpening({ ...opening(), revision: '1' })).toBeNull()
    expect(parseTrackedLinkOpening({ ...opening(), revision: null })).toBeNull()
    expect(parseTrackedLinkOpening({ ...opening(), signup_journey_id: 'user-123' })).toBeNull()
})
it('derives registered campaign identity server-side and emits only the event-specific personless envelope', async () => {
    const body = opening()
    await captureTrackedLinkOpening(body, link, 'https://peanut.me', 'app')
    const sent = JSON.parse(jest.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(sent).toEqual({
        api_key: 'test-project-key',
        uuid: body.event_id,
        timestamp: body.opened_at,
        event: 'tracked_link_visit',
        distinct_id: `tracked-link:${body.event_id}`,
        properties: {
            schema_version: 1,
            link_id: 'campaign_launch',
            link_revision_id: 'campaign_launch:1',
            signup_journey_id: body.signup_journey_id,
            opened_in: 'app',
            utm_source: 'twitter',
            utm_medium: 'social',
            utm_campaign: 'launch',
            $process_person_profile: false,
            $geoip_disable: true,
        },
    })
})
it.each(['preview', 'development'])('does not forward events from %s', async (deployment) => {
    process.env.VERCEL_ENV = deployment
    await captureTrackedLinkOpening(opening(), link, 'https://peanut.me', 'web')
    expect(fetch).not.toHaveBeenCalled()
})
it('rejects client revision substitution and non-journey capture policies', async () => {
    await captureTrackedLinkOpening({ ...opening(), revision: 2 }, link, 'https://peanut.me', 'web')
    await captureTrackedLinkOpening(opening(), { ...link, policy: 'none' }, 'https://peanut.me', 'web')
    expect(fetch).not.toHaveBeenCalled()
})
it('keeps QR body and event personless while retrying the same upstream envelope', async () => {
    const body = {
        event_id: opening().event_id,
        opened_at: opening().opened_at,
        qr_id: 'home-hero-en',
        utm_source: 'twitter',
        utm_medium: 'social',
        utm_campaign: 'launch',
        attribution_origin: 'current_url',
        attribution_adjustment: 'none',
    }
    expect(parseMarketingQrOpening({ ...body, signup_journey_id: opening().signup_journey_id })).toBeNull()
    jest.mocked(fetch)
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
    await captureMarketingQrOpening(parseMarketingQrOpening(body)!, 'https://peanut.me', 'web')
    expect(jest.mocked(fetch).mock.calls[1][1]?.body).toBe(jest.mocked(fetch).mock.calls[0][1]?.body)
    const sent = JSON.parse(jest.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(sent.event).toBe('marketing_qr_opened')
    expect(sent.properties).not.toHaveProperty('signup_journey_id')
    expect(sent.distinct_id).toBe(`marketing-qr:${body.event_id}`)
})
