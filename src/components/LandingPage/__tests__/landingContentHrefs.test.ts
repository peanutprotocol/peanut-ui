import { resolveContentHref } from '@/lib/content'
import { EN_LANDING_CONTENT_HREFS, type LandingContentHrefKey } from '../landingContentHrefs'
import { contentHrefsFor } from '../landingContentHrefs.server'

describe('landing content href overrides', () => {
    it('provides canonical English defaults for client-only consumers', () => {
        for (const href of Object.values(EN_LANDING_CONTENT_HREFS)) {
            expect(href).toMatch(/^\/en\//)
            expect(resolveContentHref(href, 'en')).toBe(href)
        }
    })

    it('resolves every es-ar homepage content link to its exact owner', () => {
        const hrefs = contentHrefsFor('es-ar')
        const expected: Record<LandingContentHrefKey, string> = {
            pricing: '/es-419/pricing',
            whatAreDigitalDollars: '/es-419/help/what-are-digital-dollars',
            verification: '/es-419/help/verification',
            passkeys: '/es-419/help/passkeys',
            securityCustody: '/es-419/help/security-custody',
            feesPricing: '/es-419/help/fees-pricing',
            supportedGeographies: '/es-419/help/supported-geographies',
            sendEurosArgentina: '/es-419/help/send-euros-argentina',
            stablecoinBalanceVisaMerchants: '/en/blog/stablecoin-balance-visa-merchants',
            help: '/es-ar/help',
            depositBank: '/es-419/help/deposit-bank',
            revolutComparison: '/es-419/compare/peanut-vs-revolut',
            mercadoPagoQr: '/es-ar/help/mercadopago-qr',
            brazil: '/es-ar/brazil',
            wiseComparison: '/es-ar/compare/peanut-vs-wise',
            unitedStates: '/es-419/united-states',
            spain: '/es-419/spain',
            mexico: '/es-419/mexico',
            paypalComparison: '/es-419/compare/peanut-vs-paypal',
            westernUnionComparison: '/es-419/compare/peanut-vs-western-union',
            securityDisclosure: '/es-419/help/security-disclosure',
        }

        expect(hrefs).toEqual(expected)
        for (const href of Object.values(hrefs)) {
            expect(resolveContentHref(href, 'es-ar')).toBe(href)
        }
    })
})
