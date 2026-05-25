/**
 * Badge catalog — code → display name + short caption + caption bg color.
 *
 * Sourced from peanut-api-ts/src/acknowledgments/service.ts BADGE_CODES.
 * Captions are intentionally short (≤11 chars) so they fit on a stamp
 * nameplate at Twitter-thumbnail size. Background colors come from the
 * peanut palette (matches tailwind tokens primary-1, secondary-1, etc).
 */

import { getBadgeIcon } from '@/components/Badges/badge.utils'

export const BADGE_CODES = [
    'BETA_TESTER',
    'DEVCONNECT_BA_2025',
    'PRODUCT_HUNT',
    'OG_2025_10_12',
    'MOST_RESTAURANTS_DEVCON',
    'BIG_SPENDER_5K',
    'MOST_PAYMENTS_DEVCON',
    'MOST_INVITES',
    'BIGGEST_REQUEST_POT',
    'SEEDLING_DEVCONNECT_BA_2025',
    'ARBIVERSE_DEVCONNECT_BA_2025',
    'CARD_PIONEER',
    'FOUNDER_HOUSE',
    'SUPPORT_SURVIVOR',
] as const

export type BadgeCode = (typeof BADGE_CODES)[number]

interface BadgeMeta {
    /** Short nameplate caption — fits on a stamp at thumbnail size. */
    caption: string
    /** Nameplate background. Tailwind color or hex. */
    captionBg: string
}

const FALLBACK: BadgeMeta = { caption: 'BADGE', captionBg: '#EFE4FF' }

const CATALOG: Record<string, BadgeMeta> = {
    BETA_TESTER: { caption: 'BETA', captionBg: '#98E9AB' },
    DEVCONNECT_BA_2025: { caption: 'DEVCONNECT', captionBg: '#FF90E8' },
    PRODUCT_HUNT: { caption: 'PRODUCTHUNT', captionBg: '#FF90E8' },
    OG_2025_10_12: { caption: 'OG · 10·12', captionBg: '#FFC900' },
    MOST_RESTAURANTS_DEVCON: { caption: 'FOODIE', captionBg: '#FFC900' },
    BIG_SPENDER_5K: { caption: 'BIG SPENDER', captionBg: '#FFC900' },
    MOST_PAYMENTS_DEVCON: { caption: 'MONEY MOVER', captionBg: '#FF90E8' },
    MOST_INVITES: { caption: 'MOST INVITES', captionBg: '#FF90E8' },
    BIGGEST_REQUEST_POT: { caption: 'BIGGEST POT', captionBg: '#FFC900' },
    SEEDLING_DEVCONNECT_BA_2025: { caption: 'SEEDLING', captionBg: '#98E9AB' },
    ARBIVERSE_DEVCONNECT_BA_2025: { caption: 'ARBIVERSE', captionBg: '#90A8ED' },
    CARD_PIONEER: { caption: 'CARD PIONEER', captionBg: '#FF90E8' },
    FOUNDER_HOUSE: { caption: 'FOUNDER HSE', captionBg: '#98E9AB' },
    SUPPORT_SURVIVOR: { caption: 'SURVIVOR', captionBg: '#EFE4FF' },
}

export function getBadgeMeta(code: string): BadgeMeta {
    return CATALOG[code] ?? FALLBACK
}

/** Re-exports the icon resolver from the shared badge.utils so callers
 *  don't need to import from two places. */
export { getBadgeIcon }
