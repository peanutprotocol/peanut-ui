import type { KillSwitches } from './kill-switches.types'

export const KILL_SWITCHES_PATH = '/config/kill-switches'

export const KILL_SWITCHES_STORAGE_KEY = 'peanut:kill-switches'

/** Used for any key the API does not send and the phone has not saved. */
export const DEFAULT_KILL_SWITCHES: KillSwitches = {
    enableFullMaintenance: false,
    enableMaintenanceBanner: false,
    maintenanceBannerPaths: [],
    disabledPaymentProviders: [],
    disabledMantecaCurrencies: [],
    disableXchainWithdraw: false,
    disableXchainSend: true,
    pixBrazilOnrampMaintenance: false,
    kycVerificationDown: false,
}

/** Page routes that stay open during full maintenance. */
export const FULL_MAINTENANCE_ALLOWED_PATHS = ['/', '/maintenance', '/support']

// shared user-facing copy for cross-chain disabled paths — keep wording aligned with TokenSelector banner
export const CROSS_CHAIN_DISABLED_MESSAGE =
    'Cross-chain claims are temporarily unavailable. Try claiming to an external wallet on the same chain as the link, or try again later.'

// Catalog key (under the `addMoney` namespace) for the BRL-via-PIX onramp
// maintenance tag — the switch carries the key, the render site translates.
export const PIX_BRAZIL_ONRAMP_MAINTENANCE = {
    badgeKey: 'pixMaintenanceBadge',
} as const
