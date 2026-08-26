import { RETURN_TO_PARAM, readReturnTo, withReturnTo } from '../return-to.utils'

const params = (entries: Record<string, string>) => new URLSearchParams(entries)

describe('withReturnTo', () => {
    it('appends the param to a route with no query string', () => {
        expect(withReturnTo('/add-money', '/profile/exchange-rate')).toBe(
            '/add-money?returnTo=%2Fprofile%2Fexchange-rate'
        )
    })

    it('preserves a query string the route already carries', () => {
        expect(withReturnTo('/withdraw?currencyCode=EUR', '/profile/exchange-rate')).toBe(
            '/withdraw?currencyCode=EUR&returnTo=%2Fprofile%2Fexchange-rate'
        )
    })

    it('keeps the origin query string of the returnTo target', () => {
        const url = withReturnTo('/add-money', '/profile/exchange-rate?from=USD&to=EUR&amount=25')
        expect(new URLSearchParams(url.split('?')[1]).get(RETURN_TO_PARAM)).toBe(
            '/profile/exchange-rate?from=USD&to=EUR&amount=25'
        )
    })

    it('drops an off-origin target rather than encoding it', () => {
        expect(withReturnTo('/add-money', 'https://evil.example/phish')).toBe('/add-money')
        expect(withReturnTo('/add-money', '//evil.example/phish')).toBe('/add-money')
    })
})

describe('readReturnTo', () => {
    it('returns null when the param is absent', () => {
        expect(readReturnTo(params({}), '/add-money')).toBeNull()
    })

    it('returns the sanitized internal path', () => {
        expect(readReturnTo(params({ returnTo: '/profile/exchange-rate?from=USD' }), '/add-money')).toBe(
            '/profile/exchange-rate?from=USD'
        )
    })

    it('rejects off-origin targets', () => {
        expect(readReturnTo(params({ returnTo: 'https://evil.example/phish' }), '/add-money')).toBeNull()
        expect(readReturnTo(params({ returnTo: '//evil.example/phish' }), '/add-money')).toBeNull()
    })

    // A self-referential value would re-push the page the user is already on —
    // i.e. a back button that does nothing, the bug this param exists to fix.
    it('rejects a target pointing at the current page', () => {
        expect(readReturnTo(params({ returnTo: '/add-money' }), '/add-money')).toBeNull()
        expect(readReturnTo(params({ returnTo: '/add-money/?method=bank' }), '/add-money')).toBeNull()
    })

    it('allows a sub-path of the current page', () => {
        expect(readReturnTo(params({ returnTo: '/add-money/germany' }), '/add-money')).toBe('/add-money/germany')
    })

    it('tolerates a missing search params object', () => {
        expect(readReturnTo(null, '/add-money')).toBeNull()
        expect(readReturnTo(undefined, '/add-money')).toBeNull()
    })
})
