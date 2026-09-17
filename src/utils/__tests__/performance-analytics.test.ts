import { apiRouteTemplate, parseServerTiming, screenTemplate, shouldSampleApiRequest } from '../performance-analytics'

describe('performance analytics templates', () => {
    it('templates identifiers by position and removes queries', () => {
        expect(apiRouteTemplate('/points/invites?includePending=false')).toBe('/points/invites')
        expect(apiRouteTemplate('/rain/cards/550e8400-e29b-41d4-a716-446655440000?secret=nope')).toBe(
            '/rain/cards/:cardId'
        )
        expect(apiRouteTemplate('/users/alice')).toBe('/users/:userId')
        expect(apiRouteTemplate('/users/username/bank')).toBe('/users/username/:username')
    })

    it('preserves explicit static endpoints and collapses unknown shapes', () => {
        expect(apiRouteTemplate('/bridge/onramp/create')).toBe('/bridge/onramp/create')
        expect(apiRouteTemplate('/manteca/withdraw/init')).toBe('/manteca/withdraw/init')
        expect(apiRouteTemplate('/future/secret-user-value')).toBe('/unmatched')
    })

    it('names fixed screen states without exporting their dynamic values', () => {
        expect(screenTemplate('/home', '?drawer=add')).toBe('/home#add')
        expect(screenTemplate('/add-money', '?country=germany&view=bank')).toBe('/add-money/:id/bank')
        expect(screenTemplate('/send', '?recipient=alice')).toBe('/send/:id')
        expect(screenTemplate('/claim/secret', '?token=also-secret')).toBe('/claim/:id')
    })

    it('parses the API app duration out of a multi-metric Server-Timing header', () => {
        expect(parseServerTiming('db;dur=8.1, app;dur=42.7')).toBe(42.7)
        expect(parseServerTiming('cache;desc="hit"')).toBeUndefined()
    })

    it('uses a uniform ten percent request sample', () => {
        expect(shouldSampleApiRequest(() => 0.099)).toBe(true)
        expect(shouldSampleApiRequest(() => 0.1)).toBe(false)
    })
})
