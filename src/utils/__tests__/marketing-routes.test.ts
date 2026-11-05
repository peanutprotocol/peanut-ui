import { STAR_LP_ROUTES } from '@/constants/star-lp-routes.consts'
import { isMarketingRoute } from '../marketing-routes'

describe('isMarketingRoute', () => {
    const nativeBuild = process.env.NEXT_PUBLIC_CAPACITOR_BUILD
    afterEach(() => {
        if (nativeBuild === undefined) delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        else process.env.NEXT_PUBLIC_CAPACITOR_BUILD = nativeBuild
    })
    it('keeps the native bootstrap and every deep-link destination on the same provider tree', () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        for (const route of ['/', '/home/', '/setup', '/en/help/delete-account', null]) {
            expect(isMarketingRoute(route)).toBe(false)
        }
    })
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

    it('treats the root-level star LPs, /lp and /request-links as marketing', () => {
        const routes = [...Object.values(STAR_LP_ROUTES), '/lp', '/request-links']
        expect(routes).toEqual(
            expect.arrayContaining([
                '/us-europe-accounts',
                '/qr-payments/argentina',
                '/qr-payments/brazil',
                '/peanut-card',
                '/self-custody',
            ])
        )
        for (const route of routes) {
            expect(isMarketingRoute(route)).toBe(true)
            expect(isMarketingRoute(`${route}/`)).toBe(true)
        }
    })

    it('matches the root-level marketing pages by exact path, never by prefix', () => {
        for (const route of [
            '/qr-payments',
            '/qr-payments/',
            '/qr-payments/unknown',
            '/qr-payments/brazil/extra',
            '/peanut-card/apply',
            '/lp/x',
            '/request-links/abc',
            '/qr-pay',
        ]) {
            expect(isMarketingRoute(route)).toBe(false)
        }
    })

    it('keeps the star LPs on the app tree in native builds', () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        for (const route of [...Object.values(STAR_LP_ROUTES), '/lp']) {
            expect(isMarketingRoute(route)).toBe(false)
        }
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
