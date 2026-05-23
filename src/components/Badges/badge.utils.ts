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
        description: `They broke things so others don't have to. Welcome to the chaos club.`,
    },
    DEVCONNECT_BA_2025: {
        path: '/badges/devconnect_2025.svg',
        description: 'Not anon. Touched grass, shook hands, breathed the same air as Vitalik.',
    },
    PRODUCT_HUNT: {
        path: '/badges/product_hunt.svg',
        description: 'Hope Dealer. Their upvote felt like a VC term sheet!',
    },
    OG_2025_10_12: {
        path: '/badges/og_v1.svg',
        description: 'This is a real OG. They were with Peanut before it was cool.',
    },
    MOST_RESTAURANTS_DEVCON: {
        path: '/badges/foodie.svg',
        description: 'This person is a real gourmet!',
    },
    BIG_SPENDER_5K: {
        path: '/badges/big_spender.svg',
        description: 'This person is a top spender.',
    },
    MOST_PAYMENTS_DEVCON: {
        path: '/badges/most_payments.svg',
        description: `Money Machine - They move money like it's light work. Most payments made!`,
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
        description: 'Peanut Ambassador. They spread the word and brought others into the ecosystem.',
    },
    ARBIVERSE_DEVCONNECT_BA_2025: {
        path: '/badges/arbiverse_devconnect.svg',
        description: 'Peanut 🤝 Arbiverse. They joined us at the amazing Arbiverse booth.',
    },
    CARD_PIONEER: {
        path: '/badges/peanut-pioneer.png',
        description: 'A true Card Pioneer. Among the first to pay everywhere with Peanut.',
    },
    FOUNDER_HOUSE: {
        path: '/badges/founder_house.png',
        description: 'Checked in at the Founder Haus. Builds IRL, not just on-chain.',
        displayName: 'Founder Haus',
    },
    SUPPORT_SURVIVOR: {
        path: '/badges/support_survivor.svg',
        description: 'Survived a real bug and helped us fix it. The brave kind of user.',
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
        description: 'First swipe. They finally used the plastic.',
        // TODO(card-launch): award on first settled Rain card payment
    },
    CARD_SPENT_1K: {
        path: '/badges/money_stack.svg',
        description: '$1K swiped. They put their money where their card is.',
        // TODO(card-launch): award on cumulative card spend ≥ $1K
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
