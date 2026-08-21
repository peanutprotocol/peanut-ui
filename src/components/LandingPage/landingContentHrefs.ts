/**
 * Canonical English defaults for homepage content links. Client-reachable
 * landing components use these when rendered outside the server-composed
 * homepage (currently /quests). LandingPageContent replaces every value with
 * the exact locale owner before passing the map across the server boundary.
 */
export interface LandingContentHrefs {
    pricing: string
    whatAreDigitalDollars: string
    verification: string
    passkeys: string
    securityCustody: string
    feesPricing: string
    supportedGeographies: string
    sendEurosArgentina: string
    stablecoinBalanceVisaMerchants: string
    help: string
    depositBank: string
    revolutComparison: string
    mercadoPagoQr: string
    brazil: string
    wiseComparison: string
    unitedStates: string
    spain: string
    mexico: string
    paypalComparison: string
    westernUnionComparison: string
    securityDisclosure: string
}

export type LandingContentHrefKey = keyof LandingContentHrefs

export const EN_LANDING_CONTENT_HREFS: LandingContentHrefs = {
    pricing: '/en/pricing',
    whatAreDigitalDollars: '/en/help/what-are-digital-dollars',
    verification: '/en/help/verification',
    passkeys: '/en/help/passkeys',
    securityCustody: '/en/help/security-custody',
    feesPricing: '/en/help/fees-pricing',
    supportedGeographies: '/en/help/supported-geographies',
    sendEurosArgentina: '/en/help/send-euros-argentina',
    stablecoinBalanceVisaMerchants: '/en/blog/stablecoin-balance-visa-merchants',
    help: '/en/help',
    depositBank: '/en/help/deposit-bank',
    revolutComparison: '/en/compare/peanut-vs-revolut',
    mercadoPagoQr: '/en/help/mercadopago-qr',
    brazil: '/en/brazil',
    wiseComparison: '/en/compare/peanut-vs-wise',
    unitedStates: '/en/united-states',
    spain: '/en/spain',
    mexico: '/en/mexico',
    paypalComparison: '/en/compare/peanut-vs-paypal',
    westernUnionComparison: '/en/compare/peanut-vs-western-union',
    securityDisclosure: '/en/help/security-disclosure',
}
