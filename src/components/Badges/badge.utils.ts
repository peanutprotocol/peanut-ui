// maps badge codes or '/badges/...' paths to static files under public/badges
import { PEANUTMAN_LOGO } from '@/assets'

const CODE_TO_PATH: Record<string, string> = {
    BETA_TESTER: '/badges/beta_tester.svg',
    DEVCONNECT_BA_2025: '/badges/devconnect_2025.svg',
    PRODUCT_HUNT: '/badges/product_hunt.svg',
    OG_2025_10_12: '/badges/og_v1.svg',
    MOST_RESTAURANTS_DEVCON: '/badges/foodie.svg',
    BIG_SPENDER_5K: '/badges/big_spender.svg',
    MOST_PAYMENTS_DEVCON: '/badges/most_payments.svg',
    MOST_INVITES: '/badges/most_invites.svg',
    BIGGEST_REQUEST_POT: '/badges/biggest_request_pot.svg',
}

export function getBadgeIcon(code?: string) {
    if (code && CODE_TO_PATH[code]) return CODE_TO_PATH[code]
    // fallback to peanutman logo
    return PEANUTMAN_LOGO
}

export { CODE_TO_PATH as BADGE_ICON_MAP }
