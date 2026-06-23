/**
 * maintenance configuration
 *
 * to enable maintenance mode, simply toggle one or both of these keys:
 *
 * 1. enableFullMaintenance: redirects ALL pages to /maintenance page
 *    - landing page (/) and support page (/support) remain accessible
 *    - maintenance banner shows on all pages (including landing and support)
 *    - use this when the entire app needs to be blocked
 *
 * 2. enableMaintenanceBanner: shows a banner on ALL pages (including landing and support)
 *    - pages remain functional, just shows a warning banner
 *    - use this when you want to warn users about ongoing maintenance
 *
 * 3. disabledPaymentProviders: array of payment providers to disable
 *    - blocks QR payments for specific providers (e.g., 'MANTECA')
 *    - shows clear error message to users about provider outage
 *    - other providers continue to work normally
 *
 * 4. disableXchainWithdraw: disables cross-chain withdrawals via Rhino SDA
 *    - restricts withdraw token selector to only USDC on Arbitrum
 *    - shows info message explaining cross-chain is temporarily unavailable
 *    - same-chain withdrawals (USDC on Arbitrum) continue to work
 *
 * 5. disableXchainSend: disables cross-chain sends via Rhino SDA (claim, request payments)
 *    - restricts token selector to only USDC on Arbitrum for claim and req_pay flows
 *    - shows info message explaining cross-chain is temporarily unavailable
 *    - same-chain operations continue to work
 *
 * 6. disableCardPioneers: hides the card pioneers waitlist feature entirely
 *    - /card page redirects to /home
 *    - /lp/card marketing page redirects to /
 *    - card pioneers section hidden from landing page
 *    - card pioneer modal, carousel cta, and perk rewards hidden from home
 *    - set to false to enable the feature
 *
 * 7. pixBrazilOnrampMaintenance: warn-only flag for the BRL-via-PIX onramp (Manteca Brazil deposit)
 *    - shows a "Maintenance" tag on the Pix option in /add-money/brazil
 *    - shows a warning banner inside the deposit flow (/add-money/brazil/manteca)
 *    - does NOT block deposits — the option stays usable (warn-only)
 *    - set to true when PIX deposits degrade again; both surfaces read it through
 *      isPixBrazilOnrampUnderMaintenance() so they can never drift apart
 *
 * note: if either mode is enabled, the maintenance banner will show everywhere
 *
 * I HOPE WE NEVER NEED TO USE THIS...
 *
 */

export type PaymentProvider = 'MANTECA'

interface MaintenanceConfig {
    enableFullMaintenance: boolean
    enableMaintenanceBanner: boolean
    disabledPaymentProviders: PaymentProvider[]
    disableXchainWithdraw: boolean
    disableXchainSend: boolean
    disableCardPioneers: boolean
    pixBrazilOnrampMaintenance: boolean
}

const underMaintenanceConfig: MaintenanceConfig = {
    enableFullMaintenance: false, // set to true to redirect all pages to /maintenance
    enableMaintenanceBanner: false, // set to true to show maintenance banner on all pages
    disabledPaymentProviders: [], // set to ['MANTECA'] to disable Manteca QR payments
    disableXchainWithdraw: true, // set to true to disable cross-chain withdrawals (only allows USDC on Arbitrum)
    disableXchainSend: true, // set to true to disable cross-chain sends (claim, request payments - only allows USDC on Arbitrum)
    disableCardPioneers: true, // set to false to enable the Card Pioneers waitlist feature
    pixBrazilOnrampMaintenance: false, // set to true when BRL-via-PIX deposits degrade again
}

// shared user-facing copy for cross-chain disabled paths — keep wording aligned with TokenSelector banner
export const CROSS_CHAIN_DISABLED_MESSAGE =
    'Cross-chain claims are temporarily unavailable. Try claiming to an external wallet on the same chain as the link, or try again later.'

// shared user-facing copy for the BRL-via-PIX onramp maintenance warning — keep the list tag and
// the in-flow banner aligned
export const PIX_BRAZIL_ONRAMP_MAINTENANCE = {
    badge: 'Maintenance',
    title: 'PIX deposits are under maintenance',
    description:
        'PIX deposits are currently unstable and may be delayed or fail. You can still continue, but service may be unreliable until this is resolved.',
}

/**
 * Whether the BRL-via-PIX onramp (Manteca Brazil deposit) is flagged warn-only under maintenance.
 *
 * Single source of truth for the two surfaces that warn about it — the "Maintenance" tag on the
 * Pix option in the add-money country list, and the in-flow banner on /add-money/brazil/manteca.
 * Callers add only their own context check (the `pix-add` method, or country `BR`); the maintenance
 * determination lives here so the two surfaces can never drift apart.
 */
export function isPixBrazilOnrampUnderMaintenance(): boolean {
    return underMaintenanceConfig.pixBrazilOnrampMaintenance
}

export default underMaintenanceConfig
