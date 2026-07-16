// Inbound campaign-resolution maps for /invite. Pure data, kept out of the
// InvitesPage client component so they can be unit-tested in isolation: every
// value here is a badge code, and if it isn't present in BADGES the awarded
// badge silently renders the Peanutman fallback + raw backend name (the
// parallel-maps→single-record regression). campaign-maps.test.ts guards that.

// offramp.xyz → Peanut migration badge. Single FE source of truth for the code —
// the add-money entry gate (AddMoneyMethodSelection) and both maps below key on
// it. Mirrors peanut-api-ts BADGE_CODES.OFFRAMP_USER.
export const OFFRAMP_BADGE_CODE = 'OFFRAMP_USER'

// mapping of special invite codes to their campaign tags
// when these invite codes are used, the corresponding campaign tag is automatically applied
export const INVITE_CODE_TO_CAMPAIGN_MAP: Record<string, string> = {
    arbiverseinvitesyou: 'ARBIVERSE_DEVCONNECT_BA_2025',
    squirrelinvitesyou: 'ARBIVERSE_DEVCONNECT_BA_2025', // temporary: maps to arbiverse until 12pm noon tomorrow
    founderhaus: 'FOUNDER_HOUSE',
    alumni: 'EVENT_ALUMNI',
    touched_grass: 'TOUCHED_GRASS',
    offramp: OFFRAMP_BADGE_CODE,
    irl_nomads: 'IRL_NOMADS',
    survivor: 'SUPPORT_SURVIVOR',
    notsoshhh: 'NOT_SO_SHHHH',
    festajunina: 'FESTA_JUNINA_2026',
    cardalpha: 'CARD_ALPHA',
    psyops: 'PSYOPS_DIVISION',
    founding: 'FOUNDING_PIONEER',
    manicero: 'MANICERO',
}

// Map inbound `utm_campaign` values to the badge codes the backend whitelists.
// Lets marketing/event links use a single UTM-shaped URL — PostHog auto-captures
// utm_* on $pageview so the same string also flows into the analytics funnel.
// Backend whitelist lives in peanut-api-ts/src/routes/badge.ts + invite.ts; keep
// in sync when adding a new entry here.
export const UTM_CAMPAIGN_TO_BADGE_MAP: Record<string, string> = {
    'token-nation-2026': 'TOKEN_NATION_SP_2026',
    ethfloripa: 'ETHFLORIPA_HUB',
    alumni: 'EVENT_ALUMNI',
    'touched-grass': 'TOUCHED_GRASS',
    offramp: OFFRAMP_BADGE_CODE,
    'festa-junina': 'FESTA_JUNINA_2026',
    'card-alpha': 'CARD_ALPHA',
    'irl-nomads': 'IRL_NOMADS',
    manicero: 'MANICERO',
}

// Resolve the effective campaign (a badge code, or a raw passthrough tag) from
// the three places it can arrive on /invite. Precedence:
//   1. explicit ?campaign= / ?campaignTag= — mapped through the UTM map first so
//      a human-facing lowercase token (?campaign=offramp) resolves to its badge
//      code instead of reaching /badge/award raw and 400ing; unmapped values
//      pass through unchanged (?campaign=OFFRAMP_USER still works).
//      NOTE: this deliberately makes ?campaign=<tag> behave exactly like
//      ?utm_campaign=<tag> — users and partners can't be expected to know the
//      difference between the two param spellings.
//   2. a mapped special invite code (?code=offramp).
//   3. ?utm_campaign= — last so an explicit ?campaign= wins on links carrying both.
export function resolveCampaign(
    campaignParam: string | null | undefined,
    inviteCode: string | null | undefined,
    utmCampaignParam: string | null | undefined
): string | undefined {
    return (
        (campaignParam && UTM_CAMPAIGN_TO_BADGE_MAP[campaignParam.toLowerCase()]) ||
        campaignParam ||
        (inviteCode ? INVITE_CODE_TO_CAMPAIGN_MAP[inviteCode] : undefined) ||
        (utmCampaignParam ? UTM_CAMPAIGN_TO_BADGE_MAP[utmCampaignParam] : undefined) ||
        undefined
    )
}

// Bare ?campaign= links (no invite code) that are claimable without an invite —
// the InvitesPage auto-claim effect fires for these even for an already-logged-in
// user, and they bypass the "invalid invite" gate. Two flavours:
//  - Waitlist-skip: the badge is also in peanut-api-ts SKIP_BADGE_CODES, so
//    claiming it skips the card waitlist. `/invite` shows skip-the-waitlist copy.
//    `skip` itself is the original bypass — the backend /badge/award also flips
//    hasAppAccess + cardFlowEarlyAccessAt for it. Keep this set in sync with
//    peanut-api-ts SKIP_BADGE_CODES.
//  - Vanity: a commemorative badge with NO card-waitlist skip. Claimable from a
//    bare link, but `/invite` shows generic badge-claim copy (not "skip").
export const SKIP_CAMPAIGN = 'skip'
export const WAITLIST_SKIP_CAMPAIGNS: ReadonlySet<string> = new Set([SKIP_CAMPAIGN, 'event_alumni'])
export const BARE_VANITY_CAMPAIGNS: ReadonlySet<string> = new Set([
    'touched_grass',
    'card_alpha',
    'festa_junina_2026',
    'irl_nomads',
    'offramp_user',
    'manicero',
])

export type CampaignClassification = {
    /** Claimable from a bare link with no invite code (auto-claim + gate bypass). */
    isBareClaimCampaign: boolean
    /** Subset of the above whose copy promises a card-waitlist skip. */
    isWaitlistSkip: boolean
}

// Classify a resolved campaign for a visitor carrying the given invite code (if
// any). A campaign is only "bare-claimable" when there is no invite code — with
// an invite code the normal invite-validation path owns the flow. Matching is
// case-insensitive (campaign codes arrive in any case from ?campaign= URLs).
export function classifyBareCampaign(
    campaign: string | undefined,
    inviteCode: string | undefined
): CampaignClassification {
    const key = campaign?.toLowerCase()
    const isBare = !inviteCode && !!key
    const isWaitlistSkip = isBare && WAITLIST_SKIP_CAMPAIGNS.has(key!)
    const isVanity = isBare && BARE_VANITY_CAMPAIGNS.has(key!)
    return { isBareClaimCampaign: isWaitlistSkip || isVanity, isWaitlistSkip }
}
