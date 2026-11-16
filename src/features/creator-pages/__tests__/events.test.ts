import { goHandoffPath } from '@/features/tracked-links/contract'
import { goVisitPosthogProperties } from '@/features/tracked-links/visit-properties'
import { creatorPageFixture } from '../preview-fixture'
import { creatorPageEventProperties } from '../events'

const mockJourney = jest.fn()
jest.mock('@/utils/signup-attribution', () => ({ readSignupAttribution: () => mockJourney() }))

const JOURNEY_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => mockJourney.mockReturnValue({ journeyId: JOURNEY_ID }))

describe('creatorPageEventProperties', () => {
    const visit = {
        username: 'juanacervio',
        placement: 'ig' as const,
        code: 7,
        utm: { source: 'x', medium: 'paid', campaign: 'nita-nov', content: 'reel-2' },
        referrerHost: 'l.instagram.com',
    }
    const page = {
        ...creatorPageFixture('juanacervio', 'g2'),
        visit,
        ctaHref: goHandoffPath(visit, { variant: 'g2', experimentId: 'nita-2026-11-a' }),
    }

    it('carries the creator, the variant, the experiment, the journey and every placement label', () => {
        expect(creatorPageEventProperties(page, { deviceOs: 'ios', inAppBrowser: 'instagram' })).toEqual({
            link_id: 'invite_' + '0'.repeat(64),
            signup_journey_id: JOURNEY_ID,
            opened_in: 'web',
            placement: 'ig',
            code: 7,
            utm_source: 'x',
            utm_medium: 'paid',
            utm_campaign: 'nita-nov',
            utm_content: 'reel-2',
            referrer_host: 'l.instagram.com',
            page_variant: 'g2',
            page_experiment: 'nita-2026-11-a',
            creator_username: 'juanacervio',
            device_os: 'ios',
            in_app_browser: 'instagram',
        })
    })

    it('adds only its three own keys to the labels of the engine visit', () => {
        const ours = { creator_username: 'juanacervio', device_os: 'android', in_app_browser: 'none' }
        expect(creatorPageEventProperties(page, { deviceOs: 'android', inAppBrowser: 'none' })).toEqual({
            ...goVisitPosthogProperties(page),
            ...ours,
        })
        // None of ours may shadow a join key of tracked_link_visit.
        expect(Object.keys(goVisitPosthogProperties(page)).filter((key) => key in ours)).toEqual([])
    })

    it('keeps absent labels as null and never includes the button target', () => {
        mockJourney.mockReturnValue(null)
        const bare = {
            username: 'someoneelse',
            placement: null,
            code: null,
            utm: { source: null, medium: null, campaign: null, content: null },
            referrerHost: null,
        }
        const properties = creatorPageEventProperties(
            { ...creatorPageFixture('someoneelse', 'a1'), visit: bare, ctaHref: goHandoffPath(bare) },
            { deviceOs: 'other', inAppBrowser: 'none' }
        )
        expect(properties).toMatchObject({
            page_experiment: null,
            placement: null,
            referrer_host: null,
            signup_journey_id: null,
        })
        expect(JSON.stringify(properties)).not.toContain('/home')
    })
})
