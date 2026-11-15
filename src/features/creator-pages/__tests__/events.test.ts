import { creatorPageFixture } from '../creator-page-fixture'
import { creatorPageEventProperties } from '../events'

describe('creatorPageEventProperties', () => {
    it('carries the creator, the variant, the experiment and every placement label', () => {
        const page = {
            ...creatorPageFixture('juanacervio', 'g2'),
            visit: {
                username: 'juanacervio',
                placement: 'ig' as const,
                code: 7,
                utm: { source: 'x', medium: 'paid', campaign: 'nita-nov', content: 'reel-2' },
                referrerHost: 'l.instagram.com',
            },
        }
        expect(
            creatorPageEventProperties(page, 'nita-2026-11-a', { deviceOs: 'ios', inAppBrowser: 'instagram' })
        ).toEqual({
            link_id: 'invite_' + '0'.repeat(64),
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

    it('keeps absent labels as null and never includes the button target', () => {
        const page = {
            ...creatorPageFixture('someoneelse', 'a1'),
            visit: {
                username: 'someoneelse',
                placement: null,
                code: null,
                utm: { source: null, medium: null, campaign: null, content: null },
                referrerHost: null,
            },
        }
        const properties = creatorPageEventProperties(page, null, { deviceOs: 'other', inAppBrowser: 'none' })
        expect(properties).toMatchObject({ page_experiment: null, placement: null, referrer_host: null })
        expect(JSON.stringify(properties)).not.toContain('/home')
    })
})
