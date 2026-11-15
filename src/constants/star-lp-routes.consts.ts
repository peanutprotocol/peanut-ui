/** The six public feature landing pages. They live outside components/Marketing
 *  because `isMarketingRoute` (imported by the provider tree on every route)
 *  reads them, and no captured app screen may import a marketing module
 *  (scripts/screens/capture-marketing.test.mjs). StarLp/starLp.consts
 *  re-exports them, so marketing code keeps one import. */
export const STAR_LP_ROUTES = {
    usEuAccounts: '/us-europe-accounts',
    qrArgentina: '/qr-payments/argentina',
    qrBrazil: '/qr-payments/brazil',
    peanutCard: '/peanut-card',
    requestLinks: '/request-links',
    selfCustody: '/self-custody',
} as const
