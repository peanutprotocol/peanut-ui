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
}

const underMaintenanceConfig: MaintenanceConfig = {
    enableFullMaintenance: false, // set to true to redirect all pages to /maintenance
    enableMaintenanceBanner: true, // set to true to show maintenance banner on all pages
    disabledPaymentProviders: [], // set to ['MANTECA'] to disable Manteca QR payments
}

export default underMaintenanceConfig
