import { PEANUTMAN } from '@/assets/mascot'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { appBaseUrl } from '@/utils/url.utils'
import posthog from 'posthog-js'
import badgeAssets from '@/types/badge-assets.json'

/**
 * Legacy artwork fallback, GENERATED from the backend badge catalog — do not
 * hand-edit. Regenerate with `pnpm badge:check --write-manifest` in
 * peanut-api-ts and copy docs/badge-assets.json here.
 *
 * Badge identity, names, descriptions, visibility, award policy and
 * capabilities all belong to the backend catalog. These paths only keep old
 * catalog responses presentable while `iconUrl` rolls out; they must never be
 * used to infer campaign or access policy.
 */
export const BADGE_ASSET_FALLBACKS: Readonly<Record<string, string>> = badgeAssets.assets

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

/**
 * Bespoke first-person share copy, English only. This is frontend presentation
 * for the share card — deliberately NOT in the backend badge catalog, which
 * owns identity and third-person descriptions. Badges without an entry use the
 * generic line; other locales keep their translated generic copy until bespoke
 * translations ship as a content change.
 */
const BADGE_SHARE_LINES: Readonly<Record<string, string>> = {
    BETA_TESTER: "I've been in the Peanut lab since the early experiments. Officially a beta tester 🧪",
    PEANUT_SHAPER: 'I talked. They took notes. Peanut got better 🎙️',
    DEVCONNECT_BA_2025: 'Buenos Aires ✅ Peanut badge ✅ A perfect trip',
    PRODUCT_HUNT: 'I upvoted Peanut on Product Hunt before it was cool. Hope dealer, certified 🚀',
    OG_2025_10_12: 'I was here before it was cool. Certified Peanut OG 🥜',
    MOST_RESTAURANTS_DEVCON:
        'I hit more restaurants at Devconnect than the Michelin guide. Paid for all of them with Peanut 🍽️',
    BIG_SPENDER_5K: "I didn't come to Devconnect to network. I came to spend. $5K later… 💸",
    MOST_PAYMENTS_DEVCON: "I move money like it's light work. Most payments at Devconnect — certified money machine ⚡",
    MOST_INVITES: "I onboarded more people to Peanut than Coinbase's ad budget did 📈",
    BIGGEST_REQUEST_POT: 'High roller or master beggar? Either way I ran the biggest pot on Peanut 🫗',
    SEEDLING_DEVCONNECT_BA_2025: "I shill Peanut so they don't have to. Honorary squirrel 🐿️",
    ARBIVERSE_DEVCONNECT_BA_2025: 'I went looking for Arbitrum and Peanut found me 🔵',
    CARD_PIONEER: 'I was building Peanut before it had a launch. Founding Pioneer 🛠️',
    FOUNDING_PIONEER: 'I was building Peanut before it had a launch. Founding Pioneer 🛠️',
    FOUNDER_HOUSE: 'On-chain energy, off-chain handshakes. Built it IRL at Founder Haus 🤝',
    BUG_WHISPERER: 'I found a real bug in Peanut, reported it, and stuck around. Someone owes me a beer 🐛🍺',
    SUPPORT_SURVIVOR: 'I found a real bug in Peanut, reported it, and stuck around. Someone owes me a beer 🐛🍺',
    SHHHHH: "I know the secret. That's all I'm allowed to say 🤫",
    NOT_SO_SHHHH: "I couldn't keep the secret… and Peanut paid me for it 🤫💸",
    CARD_FIRST_SWIPE: 'Just put my Peanut card to work for the first time. They grow up so fast 💳',
    CARD_SPENT_1K: "Crossed $1K on the Peanut card. It's earning its keep 💳",
    FIRST_INVITE: 'Brought my first friend onto Peanut. One down, the whole group chat to go 👋',
    SECOND_INVITE: "Two friends on Peanut and counting. Word's getting around 📣",
    THIRD_INVITE: 'Three friends on Peanut, zero misses. Tip your hat 🎩',
    MINI_INFLUENCER: 'Built a little Peanut fan club, one invite at a time 🌟',
    INFLUENCER_25: 'Twenty-five friends on Peanut. The likes keep rolling in 🌟',
    MEGA_INFLUENCER: "A hundred friends on Peanut. I'm kind of a big deal now 😎",
    DUNBAR: "150 invites — more people than I can even remember. I hit Dunbar's number 🧠",
    GIGA_YAPPER: "I don't mention Peanut, I broadcast it. Giga Yapper 📢",
    FIRST_CRUMB: 'Earned my first dollar on Peanut. Proof that it pays 🪙',
    DOUBLE_DIGITS: 'Crossed into double digits on Peanut. Real money now 💰',
    VERIFIED: 'ID checked, identity confirmed. Officially verified on Peanut ✅',
    CARD_CLOSED_BETA: 'I was testing the Peanut card before you knew it existed. IYKYK 🤫💳',
    CARD_ALPHA: 'I tested the Peanut card while it was still held together with tape and hope 🩹💳',
    ARBITRUM: 'Peanut × Arbitrum. Fast chains, faster money 🔵',
    TRON: 'Peanut × Tron. I came in on the rail most dollars already ride 🔺',
    MANICERO: 'Small maní, big energy. I earned the Manicero badge 🥜',
    TOUCHED_GRASS: 'Touched grass badge. Proof that I do go outside 🌱',
    SURF_UP: "Caught the wave early. Surf's up 🏄",
    SPLITTER: 'I split the bill before it was cool. Now I skip the line 🫰',
    OFFRAMP_USER: 'I migrated to Peanut. New home, same money, one shiny badge 🥜',
    PSYOPS_DIVISION: 'Enlisted in the Peanut Psyops Division. The influence game is real 🧠',
    EVENT_ALUMNI: 'Old school. I was in the room before most of you 🎟️',
    ETHFLORIPA_HUB: 'Ilha da Magia, baby. Coconuts and consensus 🥥',
    IRL_NOMADS: 'Nomad mode on. My office is wherever the wifi is ☕',
    WAITLIST_SKIP: "Got the skip pass. It's not what you know, it's who invites you 🔑",
    ENS: 'One ENS name, no address to copy. Money still landed 🔷',
}

// Share text is:
//   <funny first-person brag>\n\nJoin me on Peanut 👉 <profileUrl>
// profileUrl is the sharer's own public profile — it showcases their badges and
// carries the join CTA.
export function getBadgeShareText(
    code: string | undefined,
    displayName: string,
    profileUrl: string,
    localized?: { locale: string; localizedFallback: string }
): string {
    if (localized && localized.locale !== 'en') return localized.localizedFallback

    const brag = (code && BADGE_SHARE_LINES[code]) || `I just unlocked the "${displayName}" badge on Peanut 🥜`
    return `${brag}\n\nJoin me on Peanut 👉 ${profileUrl}`
}

/** No local copy fallback: descriptions are owned by the backend catalog. */
export function getBadgeDescription(description?: string | null): string | null {
    return description?.trim() || null
}

// The sharer's own invite link, so a guest signup credits them.
// `generateInviteCodeLink` has no null guard — the ternary is load-bearing.
export function getBadgeShareLink(username: string | null | undefined): string {
    return username ? generateInviteCodeLink(username).inviteLink : appBaseUrl()
}

// link_type reports what the share ACTUALLY carried: without a username the
// link degrades to the bare origin, which is not an invite code.
const shareLinkType = (username: string | null | undefined) => (username ? 'invite_code' : 'none')

// One wire contract for both badge surfaces — add properties here, not at the
// call sites.
export function captureBadgeShareShown(source: string, username: string | null | undefined): void {
    posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, { source, link_type: shareLinkType(username) })
}

export function captureBadgeShare(source: string, username: string | null | undefined): void {
    const link_type = shareLinkType(username)
    posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, { source, link_type })
    posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_SHARED, { source, link_type })
}
