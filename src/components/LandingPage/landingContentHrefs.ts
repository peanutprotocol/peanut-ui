/**
 * Canonical English homepage content links. Server components resolve these to
 * their locale owner via contentHrefsFor (landingContentHrefs.server.ts);
 * client-reachable consumers receive the resolved map as a prop, or this map
 * verbatim on English-only pages (currently /quests).
 */
export const EN_LANDING_CONTENT_HREFS = {
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

export type LandingContentHrefs = Record<keyof typeof EN_LANDING_CONTENT_HREFS, string>

export type LandingContentHrefKey = keyof LandingContentHrefs
