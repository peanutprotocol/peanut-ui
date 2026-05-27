// per-badge metadata: asset path under public/badges, public-facing description,
// and optional front-end display-name override. Backend codes/names stay the same;
// overrides only affect what the user sees.
import { PEANUTMAN_LOGO } from '@/assets'

type BadgeMeta = {
    path: string
    description?: string
    displayName?: string
}

const BADGES: Record<string, BadgeMeta> = {
    BETA_TESTER: {
        path: '/badges/beta_tester.svg',
        description: `They're in the lab with us. Early enough to be part of the experiment.`,
    },
    DEVCONNECT_BA_2025: {
        path: '/badges/devconnect_2025.svg',
        description: 'Buenos Aires, baby. They came, they claimed, they ate the steak.',
    },
    PRODUCT_HUNT: {
        path: '/badges/product_hunt.svg',
        description: 'Hope Dealer. Their upvote felt like a VC term sheet!',
    },
    OG_2025_10_12: {
        path: '/badges/og_v1.svg',
        description: 'A real OG. They were with Peanut before it was cool.',
    },
    MOST_RESTAURANTS_DEVCON: {
        path: '/badges/foodie.svg',
        description: 'Hit more restaurants than the Michelin guide. Touched every menu in BA.',
    },
    BIG_SPENDER_5K: {
        path: '/badges/big_spender.svg',
        description: `They didn't come to Devconnect to network. They came to spend.`,
    },
    MOST_PAYMENTS_DEVCON: {
        path: '/badges/most_payments.svg',
        description: `Money Machine — they move money like it's light work. Most payments made!`,
    },
    MOST_INVITES: {
        path: '/badges/most_invites.svg',
        description: 'Onboarded more users than Coinbase ads!',
    },
    BIGGEST_REQUEST_POT: {
        path: '/badges/biggest_request_pot.svg',
        description: 'High Roller or Master Beggar? They created the pot with the highest number of contributors.',
    },
    SEEDLING_DEVCONNECT_BA_2025: {
        path: '/badges/seedlings_devconnect.svg',
        description: `They shill Peanut so we don't have to. Honorary squirrel.`,
    },
    ARBIVERSE_DEVCONNECT_BA_2025: {
        path: '/badges/arbiverse_devconnect.svg',
        description: 'They found the Arbiverse booth. We found them. Mutual onboarding achieved.',
    },
    CARD_PIONEER: {
        path: '/badges/peanut-pioneer.png',
        description: 'A true Card Pioneer. Among the first to pay everywhere with Peanut.',
    },
    FOUNDER_HOUSE: {
        path: '/badges/founder_house.svg',
        description: 'Built IRL at Founder Haus. On-chain energy, off-chain handshakes.',
        displayName: 'Founder Haus',
    },
    BUG_WHISPERER: {
        path: '/badges/bug_whisperer.svg',
        description: 'They found a real bug, reported it, and stayed. We owe them a beer.',
    },
    // Legacy code from the original "SUPPORT_SURVIVOR" badge. Backend still emits this code;
    // we render the new beetle asset + the renamed copy. Drop once backend migrates to BUG_WHISPERER.
    SUPPORT_SURVIVOR: {
        path: '/badges/bug_whisperer.svg',
        description: 'They found a real bug, reported it, and stayed. We owe them a beer.',
        displayName: 'Bug Whisperer',
    },
    // Card-launch badges — assets only. No backend trigger yet; entries are here
    // so the icons render the moment the API starts awarding the codes.
    SHHHHH: {
        path: '/badges/shhhhh.svg',
        description: 'They know the secret.',
        // TODO(card-launch): award on shhhhh-waitlist signup
    },
    CARD_FIRST_SWIPE: {
        path: '/badges/happy_card.svg',
        description: 'First swipe. They put their card to work.',
        // TODO(card-launch): award on first settled Rain card payment
    },
    CARD_SPENT_1K: {
        path: '/badges/money_stack.svg',
        description: '$1K swiped. They put their money where their card is.',
        // TODO(card-launch): award on cumulative card spend ≥ $1K
    },
    // Skip Pass — friends-of-Peanut who bypassed the waitlist via /invite?campaign=skip.
    // Awarded by the backend /badge/award endpoint, which also flips hasAppAccess.
    WAITLIST_SKIP: {
        path: '/badges/skip_pass.svg',
        description: 'They skipped the waitlist. A friend handed them the key and they walked right in.',
    },
}

export function getBadgeIcon(code?: string) {
    return (code && BADGES[code]?.path) || PEANUTMAN_LOGO
}

// returns the public-facing description for a badge code (third-person perspective)
export function getPublicBadgeDescription(code?: string): string | null {
    return (code && BADGES[code]?.description) || null
}

// returns the display name for a badge, applying any front-end override on top
// of whatever the backend provided. backend storage is untouched.
export function getBadgeDisplayName(code: string | undefined, fallback: string): string {
    return (code && BADGES[code]?.displayName) || fallback
}
