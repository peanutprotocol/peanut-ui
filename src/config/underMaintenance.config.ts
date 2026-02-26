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
 *    - blocks QR payments for specific providers (e.g., 'MANTECA', 'SIMPLEFI')
 *    - shows clear error message to users about provider outage
 *    - other providers continue to work normally
 *
 * 4. disableSquidWithdraw: disables cross-chain withdrawals via Squid
 *    - restricts withdraw token selector to only USDC on Arbitrum
 *    - shows info message explaining cross-chain is temporarily unavailable
 *    - same-chain withdrawals (USDC on Arbitrum) continue to work
 *
 * 5. disableSquidSend: disables cross-chain sends via Squid (claim, request payments)
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
 * note: if either mode is enabled, the maintenance banner will show everywhere
 *
 * I HOPE WE NEVER NEED TO USE THIS...
 *
 */

export type PaymentProvider = 'MANTECA' | 'SIMPLEFI'

interface MaintenanceConfig {
    enableFullMaintenance: boolean
    enableMaintenanceBanner: boolean
    disabledPaymentProviders: PaymentProvider[]
    disableSquidWithdraw: boolean
    disableSquidSend: boolean
    disableCardPioneers: boolean
}

const underMaintenanceConfig: MaintenanceConfig = {
    enableFullMaintenance: false, // set to true to redirect all pages to /maintenance
    enableMaintenanceBanner: false, // set to true to show maintenance banner on all pages
    disabledPaymentProviders: [], // set to ['MANTECA'] to disable Manteca QR payments
    disableSquidWithdraw: false, // set to true to disable cross-chain withdrawals (only allows USDC on Arbitrum)
    disableSquidSend: false, // set to true to disable cross-chain sends (claim, request payments - only allows USDC on Arbitrum)
    disableCardPioneers: true, // set to false to enable the Card Pioneers waitlist feature
}

export default underMaintenanceConfig
