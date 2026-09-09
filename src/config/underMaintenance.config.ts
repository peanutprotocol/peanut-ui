/**
 * maintenance configuration
 *
 * to enable maintenance mode, simply toggle one or both of these keys:
 *
 * 1. enableFullMaintenance: redirects ALL pages to /maintenance page
 *    - landing page (/) and support page (/support) remain accessible
 *    - maintenance banner shows on all pages EXCEPT /home (see note below)
 *    - use this when the entire app needs to be blocked
 *
 * 2. enableMaintenanceBanner: shows a banner on ALL pages EXCEPT /home
 *    - pages remain functional, just shows a warning banner
 *    - use this when you want to warn users about ongoing maintenance
 *    - scope it with maintenanceBannerPaths: [] = every page; ['/withdraw', '/add-money']
 *      = only those pages (prefix match, so '/add-money' covers '/add-money/brazil')
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
 *    - ALWAYS on in the iOS app (see DISABLE_XCHAIN_WITHDRAW_GLOBALLY below); the
 *      constant is the cross-platform ops kill-switch on top of that
 *
 * 5. disableXchainSend: disables cross-chain sends via Rhino SDA (claim, request payments)
 *    - restricts token selector to only USDC on Arbitrum for claim and req_pay flows
 *    - shows info message explaining cross-chain is temporarily unavailable
 *    - same-chain operations continue to work
 *
 * 7. pixBrazilOnrampMaintenance: warn-only flag for the BRL-via-PIX onramp (Manteca Brazil deposit)
 *    - shows a "Maintenance" tag on the Pix option in /add-money/brazil
 *    - does NOT block deposits — the option stays usable (warn-only)
 *    - set to true if the PIX onramp degrades again
 *
 * 8. disableCardPromotion: hides the funded user's Home card prompt.
 *    - direct card applications remain available.
 *
 * 9. disabledMantecaCurrencies: per-currency kill-switch for the Manteca add-money (onramp) and withdraw (offramp) flows
 *    - list the fiat currencies still down (e.g. ['BRL']) — those countries' /add-money/<country>/manteca and
 *      /withdraw/manteca show a "temporarily unavailable" screen; currencies NOT listed stay live
 *    - Manteca currencies are ARS (Argentina) and BRL (Brazil); empty array = all Manteca transfers enabled
 *    - use during a partial Manteca outage so recovered currencies (e.g. ARS) come back while others stay blocked
 *    - does NOT touch QR payments (Manteca QR / Brazil PIX-over-QR stay open) — that is disabledPaymentProviders
 *
 * 10. disableLandingCardFold: hides the homepage card offer and feature strip.
 *    - card applications and the public card landing remain available.
 *
 * note: if either mode is enabled, the maintenance banner shows everywhere EXCEPT
 * /home — home never shows it, whatever these switches say (designer ruling
 * 2026-09-03; see Global/Banner). It renders below each page's nav header.
 *
 * I HOPE WE NEVER NEED TO USE THIS...
 *
 */

import { isIOSNative } from '@/utils/capacitor'

export type PaymentProvider = 'MANTECA'

interface MaintenanceConfig {
    enableFullMaintenance: boolean
    enableMaintenanceBanner: boolean
    /** Path prefixes the maintenance banner shows on. Empty = every page. Only scopes enableMaintenanceBanner; enableFullMaintenance always shows it everywhere. */
    maintenanceBannerPaths: string[]
    disabledPaymentProviders: PaymentProvider[]
    disableXchainWithdraw: boolean
    disableXchainSend: boolean
    disableCardPromotion: boolean
    disableLandingCardFold: boolean
    pixBrazilOnrampMaintenance: boolean
    /** Manteca fiat currencies still down (e.g. ['BRL']); currencies not listed stay live. Empty = all enabled. */
    disabledMantecaCurrencies: MantecaCurrency[]
}

// Manteca first-party bank/kyc rails currently exist only in Argentina (ARS) and Brazil (BRL).
export type MantecaCurrency = 'ARS' | 'BRL'

// Cross-platform ops kill-switch for cross-chain withdrawals. Currently off:
// cross-chain is live on web and Android (stables via SDA + non-stables via
// swaps, fee shown honestly). Set true to lock every platform to USDC on Arbitrum.
const DISABLE_XCHAIN_WITHDRAW_GLOBALLY = false

const underMaintenanceConfig: MaintenanceConfig = {
    enableFullMaintenance: false, // set to true to redirect all pages to /maintenance
    enableMaintenanceBanner: false, // set to true to show maintenance banner (scope with maintenanceBannerPaths)
    maintenanceBannerPaths: [], // [] = every page; e.g. ['/withdraw', '/add-money'] targets those pages only
    disabledPaymentProviders: [], // set to ['MANTECA'] to disable Manteca QR payments (last used: 2026-08-24 outage)
    /**
     * Cross-chain withdraw is force-disabled in the iOS app, on top of the global
     * kill-switch. Getter, not a constant: the platform is only knowable once the
     * Capacitor bridge exists on `window`, so it must be read at render time —
     * module-eval time is too early (and is `false` during prerender).
     * Web and Android are untouched.
     */
    get disableXchainWithdraw() {
        return DISABLE_XCHAIN_WITHDRAW_GLOBALLY || isIOSNative()
    },
    disableXchainSend: true, // set to true to disable cross-chain sends (claim, request payments - only allows USDC on Arbitrum)
    disableCardPromotion: false, // Mute the Home card prompt; /card remains available.
    disableLandingCardFold: false,
    pixBrazilOnrampMaintenance: false, // BRL deposits restored via dynamic PIX QR (2026-07-02). Set true if the onramp degrades again.
    disabledMantecaCurrencies: [], // Manteca restored after the 2026-08-24 outage (ARS + BRL live). Add a currency here to block it during a future outage.
}

// shared user-facing copy for cross-chain disabled paths — keep wording aligned with TokenSelector banner
export const CROSS_CHAIN_DISABLED_MESSAGE =
    'Cross-chain claims are temporarily unavailable. Try claiming to an external wallet on the same chain as the link, or try again later.'

// Catalog key (under the `addMoney` namespace) for the BRL-via-PIX onramp
// maintenance tag — config carries the key, the render site translates (the
// in-flow banner was retired when the dynamic-QR deposit flow shipped).
export const PIX_BRAZIL_ONRAMP_MAINTENANCE = {
    badgeKey: 'pixMaintenanceBadge',
} as const

export default underMaintenanceConfig
