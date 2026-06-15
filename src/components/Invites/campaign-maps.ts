// Inbound campaign-resolution maps for /invite. Pure data, kept out of the
// InvitesPage client component so they can be unit-tested in isolation: every
// value here is a badge code, and if it isn't present in BADGES the awarded
// badge silently renders the Peanutman fallback + raw backend name (the
// parallel-maps→single-record regression). campaign-maps.test.ts guards that.

// mapping of special invite codes to their campaign tags
// when these invite codes are used, the corresponding campaign tag is automatically applied
export const INVITE_CODE_TO_CAMPAIGN_MAP: Record<string, string> = {
    arbiverseinvitesyou: 'ARBIVERSE_DEVCONNECT_BA_2025',
    squirrelinvitesyou: 'ARBIVERSE_DEVCONNECT_BA_2025', // temporary: maps to arbiverse until 12pm noon tomorrow
    founderhaus: 'FOUNDER_HOUSE',
    survivor: 'SUPPORT_SURVIVOR',
    notsoshhh: 'NOT_SO_SHHHH',
}

// Map inbound `utm_campaign` values to the badge codes the backend whitelists.
// Lets marketing/event links use a single UTM-shaped URL — PostHog auto-captures
// utm_* on $pageview so the same string also flows into the analytics funnel.
// Backend whitelist lives in peanut-api-ts/src/routes/badge.ts + invite.ts; keep
// in sync when adding a new entry here.
export const UTM_CAMPAIGN_TO_BADGE_MAP: Record<string, string> = {
    'token-nation-2026': 'TOKEN_NATION_SP_2026',
    ethfloripa: 'ETHFLORIPA_HUB',
}
