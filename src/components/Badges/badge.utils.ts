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
import { PEANUTMAN } from '@/assets/mascot'

export type BadgeMeta = {
    path: string
    description?: string
    displayName?: string
    // English-only bespoke copy. Missing values use the generic localized message.
    shareLine?: string
}

export const BADGES: Record<string, BadgeMeta> = {
    BETA_TESTER: {
        path: '/badges/beta_tester.svg',
        description: `They're in the lab with us. Early enough to be part of the experiment.`,
        shareLine: "I've been in the Peanut lab since the early experiments. Officially a beta tester 🧪",
    },
    DEVCONNECT_BA_2025: {
        path: '/badges/devconnect_2025.svg',
        description: 'Buenos Aires, baby. They came, they claimed, they ate the steak.',
        shareLine: 'Buenos Aires ✅ Peanut badge ✅ A perfect trip',
    },
    PRODUCT_HUNT: {
        path: '/badges/product_hunt.svg',
        description: 'Hope Dealer. Their upvote felt like a VC term sheet!',
        shareLine: 'I upvoted Peanut on Product Hunt before it was cool. Hope dealer, certified 🚀',
    },
    OG_2025_10_12: {
        path: '/badges/og_v1.svg',
        description: 'A real OG. They were with Peanut before it was cool.',
        shareLine: 'I was here before it was cool. Certified Peanut OG 🥜',
    },
    MOST_RESTAURANTS_DEVCON: {
        path: '/badges/foodie.svg',
        description: 'Hit more restaurants than the Michelin guide. Touched every menu in BA.',
        shareLine: 'I hit more restaurants at Devconnect than the Michelin guide. Paid for all of them with Peanut 🍽️',
    },
    BIG_SPENDER_5K: {
        path: '/badges/big_spender.svg',
        description: `They didn't come to Devconnect to network. They came to spend.`,
        shareLine: "I didn't come to Devconnect to network. I came to spend. $5K later… 💸",
    },
    MOST_PAYMENTS_DEVCON: {
        path: '/badges/most_payments.svg',
        description: `Money Machine — they move money like it's light work. Most payments made!`,
        shareLine: "I move money like it's light work. Most payments at Devconnect — certified money machine ⚡",
    },
    MOST_INVITES: {
        path: '/badges/most_invites.svg',
        description: 'Onboarded more users than Coinbase ads!',
        shareLine: "I onboarded more people to Peanut than Coinbase's ad budget did 📈",
    },
    BIGGEST_REQUEST_POT: {
        path: '/badges/biggest_request_pot.svg',
        description: 'High Roller or Master Beggar? They created the pot with the highest number of contributors.',
        shareLine: 'High roller or master beggar? Either way I ran the biggest pot on Peanut 🫗',
    },
    SEEDLING_DEVCONNECT_BA_2025: {
        path: '/badges/seedlings_devconnect.svg',
        description: `You shill Peanut so we don't have to. Honorary squirrel.`,
        shareLine: "I shill Peanut so they don't have to. Honorary squirrel 🐿️",
    },
    ARBIVERSE_DEVCONNECT_BA_2025: {
        path: '/badges/arbiverse_devconnect.svg',
        description: 'They found the Arbiverse booth. We found them. Mutual onboarding achieved.',
        shareLine: 'I went looking for Arbitrum and Peanut found me 🔵',
    },
    // Rebranded from "Card Pioneer" to "Founding Pioneer". Backend still emits the
    // CARD_PIONEER code (it also gates grandfathered card access + rewards), so we
    // keep the code and only repoint the FE asset/copy/name. Existing holders now
    // render the Founding Pioneer badge. (Same pattern as SUPPORT_SURVIVOR below.)
    CARD_PIONEER: {
        path: '/badges/founding_pioneer.svg',
        description: 'You built Peanut before it had a launch.',
        displayName: 'Founding Pioneer',
        shareLine: 'I was building Peanut before it had a launch. Founding Pioneer 🛠️',
    },
    // New invite-activated community badge for the early crew (invite code "founding").
    FOUNDING_PIONEER: {
        path: '/badges/founding_pioneer.svg',
        description: 'You built Peanut before it had a launch.',
        displayName: 'Founding Pioneer',
        shareLine: 'I was building Peanut before it had a launch. Founding Pioneer 🛠️',
    },
    FOUNDER_HOUSE: {
        path: '/badges/founder_house.svg',
        description: 'Built IRL at Founder Haus. On-chain energy, off-chain handshakes.',
        shareLine: 'On-chain energy, off-chain handshakes. Built it IRL at Founder Haus 🤝',
    },
    BUG_WHISPERER: {
        path: '/badges/bug_whisperer.svg',
        description: 'They found a real bug, reported it, and stayed. We owe them a beer.',
        shareLine: 'I found a real bug in Peanut, reported it, and stuck around. Someone owes me a beer 🐛🍺',
    },
    // Legacy code from the original "SUPPORT_SURVIVOR" badge. Backend still emits this code;
    // we render the new beetle asset + the renamed copy. Drop once backend migrates to BUG_WHISPERER.
    SUPPORT_SURVIVOR: {
        path: '/badges/bug_whisperer.svg',
        description: 'They found a real bug, reported it, and stayed. We owe them a beer.',
        displayName: 'Bug Whisperer',
        shareLine: 'I found a real bug in Peanut, reported it, and stuck around. Someone owes me a beer 🐛🍺',
    },
    // ── card-launch badges (awarded server-side: waitlist signup + card-spend milestones) ──
    SHHHHH: {
        path: '/badges/shhhhh.svg',
        description: 'They know the secret.',
        shareLine: "I know the secret. That's all I'm allowed to say 🤫",
    },
    NOT_SO_SHHHH: {
        path: '/badges/not_so_shhhh.svg',
        description: "You couldn't keep it quiet — and you got paid for it.",
        shareLine: "I couldn't keep the secret… and Peanut paid me for it 🤫💸",
    },
    CARD_FIRST_SWIPE: {
        path: '/badges/happy_card.svg',
        description: 'First swipe. They put their card to work.',
        shareLine: 'Just put my Peanut card to work for the first time. They grow up so fast 💳',
    },
    CARD_SPENT_1K: {
        path: '/badges/money_stack.svg',
        description: '$1K swiped. They put their money where their card is.',
        shareLine: "Crossed $1K on the Peanut card. It's earning its keep 💳",
    },
    // ── growth · invite ladder (awarded by invites_accepted count) ──────────
    FIRST_INVITE: {
        path: '/badges/first_invite.svg',
        description: 'Brought a friend to the table. One down, a whole network to go.',
        shareLine: 'Brought my first friend onto Peanut. One down, the whole group chat to go 👋',
    },
    SECOND_INVITE: {
        path: '/badges/second_invite.svg',
        description: `Word's getting around — two friends in and rising.`,
        shareLine: "Two friends on Peanut and counting. Word's getting around 📣",
    },
    THIRD_INVITE: {
        path: '/badges/third_invite.svg',
        description: 'Three friends, no misses. Tip your hat.',
        shareLine: 'Three friends on Peanut, zero misses. Tip your hat 🎩',
    },
    MINI_INFLUENCER: {
        path: '/badges/mini_influencer.svg',
        description: 'Built a little fan club, one invite at a time.',
        shareLine: 'Built a little Peanut fan club, one invite at a time 🌟',
    },
    INFLUENCER_25: {
        path: '/badges/influencer_25.svg',
        description: 'Twenty-five strong. The likes keep rolling in.',
        displayName: 'Influencer',
        shareLine: 'Twenty-five friends on Peanut. The likes keep rolling in 🌟',
    },
    MEGA_INFLUENCER: {
        path: '/badges/invites_100.svg',
        description: `A hundred friends in. They're kind of a big deal now.`,
        shareLine: "A hundred friends on Peanut. I'm kind of a big deal now 😎",
    },
    DUNBAR: {
        path: '/badges/dunbar.svg',
        description: `150 — more people than you can remember. They hit Dunbar's number.`,
        shareLine: "150 invites — more people than I can even remember. I hit Dunbar's number 🧠",
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
        shareLine: "I don't mention Peanut, I broadcast it. Giga Yapper 📢",
    },
    // ── usage · rewards-earned ladder ───────────────────────────────────────
    FIRST_CRUMB: {
        path: '/badges/first_crumb.svg',
        description: 'First dollar earned. Proof it pays.',
        displayName: 'First Dollar',
        shareLine: 'Earned my first dollar on Peanut. Proof that it pays 🪙',
    },
    DOUBLE_DIGITS: {
        path: '/badges/double_digits.svg',
        description: 'Crossed into double digits. Real money now.',
        shareLine: 'Crossed into double digits on Peanut. Real money now 💰',
    },
    // ── insider ─────────────────────────────────────────────────────────────
    VERIFIED: {
        path: '/badges/verified.svg',
        description: 'ID checked, identity confirmed. Officially verified.',
        shareLine: 'ID checked, identity confirmed. Officially verified on Peanut ✅',
    },
    CARD_CLOSED_BETA: {
        path: '/badges/card_closed_beta.svg',
        description: 'IYKYK. They were testing the card before you knew it existed.',
        displayName: 'Closed Beta',
        shareLine: 'I was testing the Peanut card before you knew it existed. IYKYK 🤫💳',
    },
    CARD_ALPHA: {
        path: '/badges/card_alpha.svg',
        description: 'You tested the Card while it was still held together with tape and hope.',
        displayName: 'Closed Alpha Tester',
        shareLine: 'I tested the Peanut card while it was still held together with tape and hope 🩹💳',
    },
    // ── community (link-granted) ────────────────────────────────────────────
    ARBITRUM: {
        path: '/badges/arbitrum.svg',
        description: 'Found on Arbitrum — mutual onboarding achieved.',
        displayName: 'Arbitrum Native',
        shareLine: 'Peanut × Arbitrum. Fast chains, faster money 🔵',
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
    // Argentine superfan in-joke badge — look closer. IYKYK.
    MANICERO: {
        path: '/badges/manicero.svg',
        description: 'Small maní. Big energy. Manicero.',
        displayName: 'Manicero',
        shareLine: 'Small maní, big energy. I earned the Manicero badge 🥜',
    },
    TOUCHED_GRASS: {
        path: '/badges/touched_grass.svg',
        description: 'You logged off and touched real grass with Peanut.',
        shareLine: 'Touched grass badge. Proof that I do go outside 🌱',
    },
    OFFRAMP_USER: {
        path: '/badges/offramp_user.png',
        description: 'You migrated to Peanut. We welcomed you.',
        shareLine: 'I migrated to Peanut. New home, same money, one shiny badge 🥜',
    },
    PSYOPS_DIVISION: {
        path: '/badges/psyops_division.svg',
        description: 'Enlisted in the Psyops Division. Welcome to the influence game.',
        displayName: 'Psyops Division',
        shareLine: 'Enlisted in the Peanut Psyops Division. The influence game is real 🧠',
    },
    EVENT_ALUMNI: {
        path: '/badges/event_alumni.svg',
        description: 'Old school. You were in the room before most.',
        shareLine: 'Old school. I was in the room before most of you 🎟️',
    },
    ETHFLORIPA_HUB: {
        path: '/badges/ethfloripa_hub.svg',
        description: 'Ilha da Magia, baby. Coconuts and consensus.',
        displayName: 'Ethereum Hub Floripa',
        shareLine: 'Ilha da Magia, baby. Coconuts and consensus 🥥',
    },
    IRL_NOMADS: {
        path: '/badges/irl_nomads.svg',
        description: 'No fixed address, just good coffee and better wifi. Certified Nomad.',
        displayName: 'Nomad Mode',
        shareLine: 'Nomad mode on. My office is wherever the wifi is ☕',
    },
    // Skip Pass — friends-of-Peanut who bypassed the waitlist via /invite?campaign=skip.
    // Awarded by the backend /badge/award endpoint, which also flips hasAppAccess.
    WAITLIST_SKIP: {
        path: '/badges/skip_pass.svg',
        description: 'They skipped the waitlist. A friend handed them the key and they walked right in.',
        shareLine: "Got the skip pass. It's not what you know, it's who invites you 🔑",
    },
    // Creator collab with Nita Cervio — her invite link carries ?campaign=nita.
    // The badge also skips the card waitlist (backend POSTLAUNCH_SKIP_BADGE_CODES).
    // `path` is the load-bearing field: syncBadgeDefinitions never sets iconUrl,
    // so without this entry the badge renders the Peanutman fallback. displayName
    // mirrors the backend name to pin the agreed title on the FE side.
    NITA: {
        path: '/badges/nita.svg',
        description: 'Nita sent you. You skipped the card line on her word.',
        displayName: "Nita's Recommendation",
    },
    NAIJA: {
        path: '/badges/naija.svg',
        description: 'Naija no dey carry last. You were here first.',
        displayName: '9JA',
    },
    TERERE: {
        path: '/badges/terere.svg',
        description: 'Tereré unlocked. You were there for round one.',
        displayName: 'Tereré',
    },
}

/** All known badge codes — derived from BADGES so we never duplicate the
 *  list. Used by /dev/share-builder + /dev/debug for iteration. */
export const BADGE_CODES: readonly string[] = Object.keys(BADGES)

export function getBadgeIcon(code?: string): string {
    // .src: the svg import is StaticImageData (typed `any` by the module shim, so the
    // annotation alone can't enforce this) — raw <img src> consumers need a string URL.
    return (code && BADGES[code]?.path) || PEANUTMAN.src
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

// Builds the text pre-filled into the native share sheet (Web Share API) / copied to
// clipboard when a badge is shared from the detail modal. Composition:
//   <funny first-person brag>\n\nJoin me on Peanut 👉 <profileUrl>
// profileUrl is the sharer's own public profile — it showcases their badges and
// carries the join CTA. Other locales keep their existing translated generic copy
// until bespoke translations ship in a separate content change. CERTIFIED_YAPPER,
// TOKEN_NATION_SP_2026, and FESTA_JUNINA_2026 intentionally use the generic copy.
export function getBadgeShareText(
    code: string | undefined,
    displayName: string,
    profileUrl: string,
    localized?: { locale: string; localizedFallback: string }
): string {
    if (localized && localized.locale !== 'en') return localized.localizedFallback

    const brag = (code && BADGES[code]?.shareLine) || `I just unlocked the "${displayName}" badge on Peanut 🥜`
    return `${brag}\n\nJoin me on Peanut 👉 ${profileUrl}`
}
