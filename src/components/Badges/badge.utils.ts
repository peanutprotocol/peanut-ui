import { PEANUTMAN } from '@/assets/mascot'

/**
 * Legacy artwork only. Badge identity, names, descriptions, visibility, award
 * policy, and capabilities all belong to the backend catalog. These paths keep
 * old catalog responses presentable while `iconUrl` rolls out; they must never
 * be used to infer campaign or access policy.
 */
export const BADGE_ASSET_FALLBACKS: Readonly<Record<string, string>> = {
    BETA_TESTER: '/badges/beta_tester.svg',
    DEVCONNECT_BA_2025: '/badges/devconnect_2025.svg',
    PRODUCT_HUNT: '/badges/product_hunt.svg',
    OG_2025_10_12: '/badges/og_v1.svg',
    MOST_RESTAURANTS_DEVCON: '/badges/foodie.svg',
    BIG_SPENDER_5K: '/badges/big_spender.svg',
    MOST_PAYMENTS_DEVCON: '/badges/most_payments.svg',
    MOST_INVITES: '/badges/most_invites.svg',
    BIGGEST_REQUEST_POT: '/badges/biggest_request_pot.svg',
    SEEDLING_DEVCONNECT_BA_2025: '/badges/seedlings_devconnect.svg',
    ARBIVERSE_DEVCONNECT_BA_2025: '/badges/arbiverse_devconnect.svg',
    CARD_PIONEER: '/badges/founding_pioneer.svg',
    FOUNDING_PIONEER: '/badges/founding_pioneer.svg',
    FOUNDER_HOUSE: '/badges/founder_house.svg',
    BUG_WHISPERER: '/badges/bug_whisperer.svg',
    SUPPORT_SURVIVOR: '/badges/bug_whisperer.svg',
    SHHHHH: '/badges/shhhhh.svg',
    NOT_SO_SHHHH: '/badges/not_so_shhhh.svg',
    CARD_FIRST_SWIPE: '/badges/happy_card.svg',
    CARD_SPENT_1K: '/badges/money_stack.svg',
    FIRST_INVITE: '/badges/first_invite.svg',
    SECOND_INVITE: '/badges/second_invite.svg',
    THIRD_INVITE: '/badges/third_invite.svg',
    MINI_INFLUENCER: '/badges/mini_influencer.svg',
    INFLUENCER_25: '/badges/influencer_25.svg',
    MEGA_INFLUENCER: '/badges/invites_100.svg',
    DUNBAR: '/badges/dunbar.svg',
    CERTIFIED_YAPPER: '/badges/certified_yapper.svg',
    GIGA_YAPPER: '/badges/giga_yapper.svg',
    FIRST_CRUMB: '/badges/first_crumb.svg',
    DOUBLE_DIGITS: '/badges/double_digits.svg',
    VERIFIED: '/badges/verified.svg',
    CARD_CLOSED_BETA: '/badges/card_closed_beta.svg',
    CARD_ALPHA: '/badges/card_alpha.svg',
    ARBITRUM: '/badges/arbitrum.svg',
    TOKEN_NATION_SP_2026: '/badges/token_nation_2026.svg',
    FESTA_JUNINA_2026: '/badges/festa_junina_2026.svg',
    MANICERO: '/badges/manicero.svg',
    TOUCHED_GRASS: '/badges/touched_grass.svg',
    OFFRAMP_USER: '/badges/offramp_user.png',
    PSYOPS_DIVISION: '/badges/psyops_division.svg',
    EVENT_ALUMNI: '/badges/event_alumni.svg',
    ETHFLORIPA_HUB: '/badges/ethfloripa_hub.svg',
    IRL_NOMADS: '/badges/irl_nomads.svg',
    WAITLIST_SKIP: '/badges/skip_pass.svg',
    NITA: '/badges/nita.svg',
    NAIJA: '/badges/naija.svg',
    TERERE: '/badges/terere.svg',
}

/** Legacy-only iteration for the internal share-asset builder. */
export const BADGE_CODES: readonly string[] = Object.keys(BADGE_ASSET_FALLBACKS)

// Mirror the backend catalog boundary during rolling deploys and for legacy DB
// rows. Badge art is deliberately limited to stable same-origin public assets;
// arbitrary remote, data, traversal, query, and fragment URLs never reach an
// image renderer.
const SAFE_BADGE_ICON_PATH = /^\/badges\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:svg|png|webp|avif)$/

/** Prefer safe backend presentation; fall back to legacy art, then generic art. */
export function getBadgeIcon(code?: string, iconUrl?: string | null): string {
    const catalogIcon = iconUrl && SAFE_BADGE_ICON_PATH.test(iconUrl) ? iconUrl : null
    return catalogIcon || (code && BADGE_ASSET_FALLBACKS[code]) || PEANUTMAN.src
}

/** Backend names are authoritative; unknown/legacy responses remain readable. */
export function getBadgeDisplayName(code?: string, name?: string | null): string {
    return name?.trim() || code || 'Badge'
}

/** No local copy fallback: descriptions are owned by the backend catalog. */
export function getBadgeDescription(description?: string | null): string | null {
    return description?.trim() || null
}
