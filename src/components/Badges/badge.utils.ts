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

// public-facing descriptions for badges (third-person perspective)
const PUBLIC_DESCRIPTIONS: Record<string, string> = {
    BETA_TESTER: `They broke things so others don't have to. Welcome to the chaos club — Beta Tester badge unlocked.`,
    OG_2025_10_12: 'They used v0.1 with pride (and occasional pain).',
    DEVCONNECT_BA_2025: 'Not anon. Touched grass, shook hands, breathed the same air as Vitalik.',
    PRODUCT_HUNT: 'Hope Dealer — Their upvote felt like a VC term sheet.',
    MOST_RESTAURANTS_DEVCON: 'Gas Guzzler (IRL Edition) — burned calories like ETH in a bull run.',
    BIG_SPENDER_5K: 'Wallet Warrior - They moved like they own the bank. Top spender badge unlocked.',
    MOST_PAYMENTS_DEVCON: `Money Machine - They move money like it's light work. Most payments made!`,
    MOST_INVITES: 'Human Airdrop Mechanism — they onboarded more wallets than Coinbase ads.',
    BIGGEST_REQUEST_POT:
        'High Roller or Master Beggar? They created the pot with the highest number of contributors. Respect... we think?',
}

export function getBadgeIcon(code?: string) {
    if (code && CODE_TO_PATH[code]) return CODE_TO_PATH[code]
    // fallback to peanutman logo
    return PEANUTMAN_LOGO
}

// returns the public-facing description for a badge code (third-person perspective)
export function getPublicBadgeDescription(code?: string): string | null {
    if (!code) return null
    return PUBLIC_DESCRIPTIONS[code] || null
}

export { CODE_TO_PATH as BADGE_ICON_MAP }
