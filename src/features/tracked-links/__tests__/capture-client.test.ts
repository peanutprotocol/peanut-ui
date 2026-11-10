import { captureTrackedLinkVisit } from '../capture-client'
import { deliverOpening } from '../delivery'
import type { ResolvedAcquisitionLink } from '../contract'
import type { SignupAttributionContext } from '@/utils/signup-attribution'

jest.mock('../delivery', () => ({ deliverOpening: jest.fn().mockResolvedValue({ outcome: 'accepted' }) }))
jest.mock('@/utils/posthog-setup', () => ({ isAnalyticsCaptureBuild: () => true }))
const link = (): ResolvedAcquisitionLink => ({
    schemaVersion: 1,
    linkId: 'invite_' + 'a'.repeat(64),
    slug: 'alice',
    revision: 1,
    kind: 'invite',
    status: 'active',
    policy: 'journey',
    destination: { key: 'app-entry', continuation: '/home' },
    invite: { code: 'alice' },
})
const journey: SignupAttributionContext = {
    schemaVersion: '1',
    journeyId: '22222222-2222-4222-8222-222222222222',
    platform: 'web',
    analyticsState: 'enabled',
    captureMethod: 'browser',
    firstTouch: { occurredAt: new Date().toISOString() },
}
const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    localStorage.clear()
    Object.defineProperty(crypto, 'randomUUID', {
        configurable: true,
        value: () => '11111111-1111-4111-8111-111111111111',
    })
})
afterEach(() => {
    delete (document as Document & { prerendering?: boolean }).prerendering
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey
})
it('sends one anonymous browser ingress for one logical activation', () => {
    const descriptor = link()
    captureTrackedLinkVisit(descriptor, { openedIn: 'web', journey })
    captureTrackedLinkVisit(descriptor, { openedIn: 'web', journey })
    expect(deliverOpening).toHaveBeenCalledTimes(1)
    const [url, serialized, surface, options] = jest.mocked(deliverOpening).mock.calls[0]
    expect(url).toBe('/api/tracked-links/open')
    expect(surface).toBe('tracked_link')
    expect(options).toEqual({ keepalive: true, maxAttempts: 1 })
    expect(JSON.parse(serialized)).toEqual({
        event_id: '11111111-1111-4111-8111-111111111111',
        opened_at: expect.any(String),
        slug: 'alice',
        revision: 1,
        signup_journey_id: journey.journeyId,
    })
})
it('suppresses browser-to-native continuation and allows a fresh direct native activation', () => {
    captureTrackedLinkVisit(link(), { openedIn: 'app', seen: true, journey })
    expect(deliverOpening).not.toHaveBeenCalled()
    captureTrackedLinkVisit(link(), { openedIn: 'app', journey })
    expect(deliverOpening).toHaveBeenCalledWith(
        'https://peanut.me/api/tracked-links/open',
        expect.any(String),
        'tracked_link',
        { keepalive: false, maxAttempts: 2 }
    )
})
it('does not capture before activation, without a journey, or after consent is denied', () => {
    Object.defineProperty(document, 'prerendering', { configurable: true, value: true })
    captureTrackedLinkVisit(link(), { openedIn: 'web', journey })
    delete (document as Document & { prerendering?: boolean }).prerendering
    captureTrackedLinkVisit(link(), { openedIn: 'web', journey: null })
    localStorage.setItem('__ph_opt_in_out_phc_test', '0')
    captureTrackedLinkVisit(link(), { openedIn: 'web', journey })
    expect(deliverOpening).not.toHaveBeenCalled()
})
