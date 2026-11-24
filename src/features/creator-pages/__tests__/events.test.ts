import { creatorPageEventProperties } from '../events'
import { creatorPageFixture } from '../preview-fixture'

describe('creatorPageEventProperties', () => {
    it('carries the creator, the experiment, the variant and the browser, and nothing else', () => {
        expect(
            creatorPageEventProperties(creatorPageFixture('juanacervio', 'g2'), {
                deviceOs: 'ios',
                inAppBrowser: 'instagram',
            })
        ).toEqual({
            creator_username: 'juanacervio',
            experiment_id: 'nita-2026-11-a',
            variant: 'g2',
            device_os: 'ios',
            in_app_browser: 'instagram',
        })
    })
})
