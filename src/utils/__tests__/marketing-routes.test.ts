import { isMarketingRoute } from '../marketing-routes'

describe('isMarketingRoute', () => {
    it('treats the landing page as marketing', () => {
        expect(isMarketingRoute('/')).toBe(true)
    })

    it('treats localized landing pages as marketing', () => {
        expect(isMarketingRoute('/es-ar')).toBe(true)
        expect(isMarketingRoute('/pt-br/')).toBe(true)
        expect(isMarketingRoute('/es-419')).toBe(true)
    })

    it('treats localized marketing pages as marketing', () => {
        expect(isMarketingRoute('/es-419/pricing')).toBe(true)
        expect(isMarketingRoute('/pt-br/compare/wise')).toBe(true)
        expect(isMarketingRoute('/en/terms')).toBe(true)
    })

    it('keeps app routes on the full provider tree', () => {
        for (const route of ['/home', '/setup', '/qr-pay', '/add-money', '/card', '/history', '/claim']) {
            expect(isMarketingRoute(route)).toBe(false)
        }
    })

    it('does not mistake the app withdraw flow for the marketing page of the same name', () => {
        // `/withdraw` is BOTH a marketing page (under a locale) and the app's
        // withdraw flow (under `(mobile-ui)`). Matching on the segment instead
        // of the locale prefix would strip the wallet providers off the app one.
        expect(isMarketingRoute('/withdraw')).toBe(false)
        expect(isMarketingRoute('/es-ar/withdraw')).toBe(true)
    })

    it('fails safe to the app tree for unknown or missing paths', () => {
        expect(isMarketingRoute('/some-new-app-route')).toBe(false)
        expect(isMarketingRoute(null)).toBe(false)
        expect(isMarketingRoute(undefined)).toBe(false)
        expect(isMarketingRoute('')).toBe(false)
    })
})
