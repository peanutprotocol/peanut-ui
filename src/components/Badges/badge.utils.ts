// per-badge metadata: asset path under public/badges, public-facing description,
// and optional front-end display-name override. Backend codes/names stay the same;
// overrides only affect what the user sees.
//
// This is the SINGLE SOURCE OF TRUTH for badge codes + metadata on the FE.
// Don't add a parallel catalog elsewhere — consumers (share-asset stamps,
// /dev/share-builder, debug pages) read `BADGES` and helpers below directly.
//
// Codes here must match the backend registry (peanut-api-ts
// src/acknowledgments/seed-definitions.ts). How the whole system works + how to
// add a badge: peanut-api-ts/docs/BADGES.md.
import { PEANUTMAN_LOGO } from '@/assets/mascot'

export type BadgeMeta = {
    path: string
    description?: string
    displayName?: string
}

export const BADGES: Record<string, BadgeMeta> = {
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
        description: `You shill Peanut so we don't have to. Honorary squirrel.`,
    },
    ARBIVERSE_DEVCONNECT_BA_2025: {
        path: '/badges/arbiverse_devconnect.svg',
        description: 'They found the Arbiverse booth. We found them. Mutual onboarding achieved.',
    },
    // Rebranded from "Card Pioneer" to "Founding Pioneer". Backend still emits the
    // CARD_PIONEER code (it also gates grandfathered card access + cashback), so we
    // keep the code and only repoint the FE asset/copy/name. Existing holders now
    // render the Founding Pioneer badge. (Same pattern as SUPPORT_SURVIVOR below.)
    CARD_PIONEER: {
        path: '/badges/founding_pioneer.svg',
        description: 'You built Peanut before it had a launch.',
        displayName: 'Founding Pioneer',
    },
    // New invite-activated community badge for the early crew (invite code "founding").
    FOUNDING_PIONEER: {
        path: '/badges/founding_pioneer.svg',
        description: 'You built Peanut before it had a launch.',
        displayName: 'Founding Pioneer',
    },
    FOUNDER_HOUSE: {
        path: '/badges/founder_house.svg',
        description: 'Built IRL at Founder Haus. On-chain energy, off-chain handshakes.',
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
    NOT_SO_SHHHH: {
        path: '/badges/not_so_shhhh.svg',
        description: "You couldn't keep it quiet — and you got paid for it.",
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
    // ── growth · invite ladder (awarded by invites_accepted count) ──────────
    FIRST_INVITE: {
        path: '/badges/first_invite.svg',
        description: 'Brought a friend to the table. One down, a whole network to go.',
    },
    SECOND_INVITE: {
        path: '/badges/second_invite.svg',
        description: `Word's getting around — two friends in and rising.`,
    },
    THIRD_INVITE: {
        path: '/badges/third_invite.svg',
        description: 'Three friends, no misses. Tip your hat.',
    },
    MINI_INFLUENCER: {
        path: '/badges/mini_influencer.svg',
        description: 'Built a little fan club, one invite at a time.',
    },
    INFLUENCER_25: {
        path: '/badges/influencer_25.svg',
        description: 'Twenty-five strong. The likes keep rolling in.',
        displayName: 'Influencer',
    },
    MEGA_INFLUENCER: {
        path: '/badges/invites_100.svg',
        description: `A hundred friends in. They're kind of a big deal now.`,
    },
    DUNBAR: {
        path: '/badges/dunbar.svg',
        description: `150 — more people than you can remember. They hit Dunbar's number.`,
    },
    // ── growth · invite-streak ladder — DEFERRED ────────────────────────────
    // A streak is ephemeral live state that resets on a miss, not a permanent
    // binary badge. Deferred to a dedicated streak feature; assets stay in
    // public/badges/. Backend defs are commented out in peanut-api-ts
    // seed-definitions.ts — keep these parked too so codes stay aligned.
    // STREAK_SPARK:    { path: '/badges/streak_spark.svg',    description: `Seven days running. The streak's lit.`,       displayName: 'Spark' },
    // STREAK_BLAZE:    { path: '/badges/streak_blaze.svg',    description: `Thirty days, no gaps. They're blazing.`,       displayName: 'Blaze' },
    // STREAK_WILDFIRE: { path: '/badges/streak_wildfire.svg', description: 'A hundred days straight. This is a wildfire now.', displayName: 'Wildfire' },
    // ── mentions · yaps ─────────────────────────────────────────────────────
    CERTIFIED_YAPPER: {
        path: '/badges/certified_yapper.svg',
        description: `Certified loud. They talked about Peanut so we didn't have to.`,
    },
    GIGA_YAPPER: {
        path: '/badges/giga_yapper.svg',
        description: `Giga loud. They don't mention Peanut, they broadcast it.`,
    },
    // ── usage · rewards-earned ladder ───────────────────────────────────────
    FIRST_CRUMB: {
        path: '/badges/first_crumb.svg',
        description: 'First dollar earned. Proof it pays.',
        displayName: 'First Dollar',
    },
    DOUBLE_DIGITS: {
        path: '/badges/double_digits.svg',
        description: 'Crossed into double digits. Real money now.',
    },
    // ── insider ─────────────────────────────────────────────────────────────
    VERIFIED: {
        path: '/badges/verified.svg',
        description: 'ID checked, identity confirmed. Officially verified.',
    },
    CARD_CLOSED_BETA: {
        path: '/badges/card_closed_beta.svg',
        description: 'IYKYK. They were testing the card before you knew it existed.',
        displayName: 'Closed Beta',
    },
    CARD_ALPHA: {
        path: '/badges/card_alpha.svg',
        description: 'You tested the Card while it was still held together with tape and hope.',
        displayName: 'Closed Alpha Tester',
    },
    // ── community (link-granted) ────────────────────────────────────────────
    ARBITRUM: {
        path: '/badges/arbitrum.svg',
        description: 'Found on Arbitrum — mutual onboarding achieved.',
        displayName: 'Arbitrum Native',
    },
    // Event badges — assets shipped to main via the May 29 hotfix but the catalog
    // entries were dropped when the parallel maps collapsed into this single BADGES
    // record, so the backend codes fell back to the Peanutman logo + raw backend name.
    TOKEN_NATION_SP_2026: {
        path: '/badges/token_nation_2026.svg',
        description: 'São Paulo, baby. They came, they claimed, they tagged the wall.',
    },
    FESTA_JUNINA_2026: {
        path: '/badges/festa_junina_2026.svg',
        description: 'You danced the quadrilha with us. Arraiá unlocked.',
        displayName: 'Arraiá Approved',
    },
    TOUCHED_GRASS: {
        path: '/badges/touched_grass.svg',
        description: 'You logged off and touched real grass with Peanut.',
    },
    PSYOPS_DIVISION: {
        path: '/badges/psyops_division.svg',
        description: 'Enlisted in the Psyops Division. Welcome to the influence game.',
        displayName: 'Psyops Division',
    },
    EVENT_ALUMNI: {
        path: '/badges/event_alumni.svg',
        description: 'Old school. You were in the room before most.',
    },
    ETHFLORIPA_HUB: {
        path: '/badges/ethfloripa_hub.svg',
        description: 'Ilha da Magia, baby. Coconuts and consensus.',
        displayName: 'Ethereum Hub Floripa',
    },
    IRL_NOMADS: {
        path: '/badges/irl_nomads.svg',
        description: 'No fixed address, just good coffee and better wifi. Certified Nomad.',
        displayName: 'Nomad Mode',
    },
    // Skip Pass — friends-of-Peanut who bypassed the waitlist via /invite?campaign=skip.
    // Awarded by the backend /badge/award endpoint, which also flips hasAppAccess.
    WAITLIST_SKIP: {
        path: '/badges/skip_pass.svg',
        description: 'They skipped the waitlist. A friend handed them the key and they walked right in.',
    },
}

/** All known badge codes — derived from BADGES so we never duplicate the
 *  list. Used by /dev/share-builder + /dev/debug for iteration. */
export const BADGE_CODES: readonly string[] = Object.keys(BADGES)

export function getBadgeIcon(code?: string): string {
    // .src: the svg import is StaticImageData (typed `any` by the module shim, so the
    // annotation alone can't enforce this) — raw <img src> consumers need a string URL.
    return (code && BADGES[code]?.path) || PEANUTMAN_LOGO.src
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
