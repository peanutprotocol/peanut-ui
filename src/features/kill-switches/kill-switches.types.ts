export type PaymentProvider = 'MANTECA'

// Manteca first-party bank/kyc rails currently exist only in Argentina (ARS) and Brazil (BRL).
export type MantecaCurrency = 'ARS' | 'BRL'

/** Incident switches, served by the API at GET /config/kill-switches. */
export interface KillSwitches {
    /** Sends every app page except /, /maintenance and /support to /maintenance. */
    enableFullMaintenance: boolean
    /** Shows the maintenance banner, scoped by maintenanceBannerPaths. Never on /home. */
    enableMaintenanceBanner: boolean
    /** Path prefixes the banner shows on ('/add-money' covers '/add-money/brazil'). Empty = every page. */
    maintenanceBannerPaths: string[]
    /** Blocks QR payments for these providers; other providers keep working. */
    disabledPaymentProviders: PaymentProvider[]
    /** Manteca add-money and withdraw currencies still down. QR payments are not affected. */
    disabledMantecaCurrencies: MantecaCurrency[]
    /** Locks withdrawals to USDC on Arbitrum, on every platform. */
    disableXchainWithdraw: boolean
    /** Locks claims and request payments to USDC on Arbitrum. */
    disableXchainSend: boolean
    /** Warn-only "Maintenance" tag on the Pix option in /add-money/brazil. */
    pixBrazilOnrampMaintenance: boolean
}
