import { BADGES } from '@/components/Badges/badge.utils'
import {
    INVITE_CODE_TO_CAMPAIGN_MAP,
    UTM_CAMPAIGN_TO_BADGE_MAP,
    WAITLIST_SKIP_CAMPAIGNS,
    BARE_VANITY_CAMPAIGNS,
    OFFRAMP_BADGE_CODE,
    classifyBareCampaigns,
    resolveCampaigns,
} from './campaign-maps'

// Regression guard. The /invite flow resolves an inbound invite code / utm_campaign
// to one of these badge codes, carries it through signup, and the UI renders
// BADGES[code] for the awarded badge. If a code here has no BADGES entry, getBadgeIcon
// falls back to the Peanutman logo and getBadgeDisplayName returns the raw backend
// name — a silent visual regression with no conflict, no type error, no runtime throw.
//
// This is exactly how TOKEN_NATION_SP_2026 + ETHFLORIPA_HUB fell out of dev (the
// May 29 event-badge hotfixes were written against the old parallel-map shape and
// their additions evaporated when merged across the May 23 single-BADGES refactor),
// and later out of main (regressed on release, fixed by 32699f171). This test fails
// the moment a campaign code points at a badge the FE can't render.
const badgeCodes = new Set(Object.keys(BADGES))

describe('campaign maps reference real BADGES codes', () => {
    it.each(Object.entries(UTM_CAMPAIGN_TO_BADGE_MAP))('utm_campaign "%s" → "%s" exists in BADGES', (_utm, code) => {
        expect(badgeCodes).toContain(code)
    })

    it.each(Object.entries(INVITE_CODE_TO_CAMPAIGN_MAP))(
        'invite code "%s" → "%s" exists in BADGES',
        (_invite, code) => {
            expect(badgeCodes).toContain(code)
        }
    )
})

describe('classifyBareCampaigns', () => {
    // A bare campaign (no invite code) must be claimable, or /invite dead-ends at
    // the "Invalid Invite Code" screen. This is the bug that left touched_grass
    // unclaimable — it was never registered as a bare campaign.
    it.each([...WAITLIST_SKIP_CAMPAIGNS, ...BARE_VANITY_CAMPAIGNS])(
        'campaign "%s" is bare-claimable with no invite code',
        (campaign) => {
            expect(classifyBareCampaigns([campaign], undefined).isBareClaimCampaign).toBe(true)
        }
    )

    it('classifies waitlist-skip vs vanity, case-insensitively', () => {
        // event_alumni skips the card waitlist → skip copy
        expect(classifyBareCampaigns(['EVENT_ALUMNI'], undefined)).toEqual({
            isBareClaimCampaign: true,
            isWaitlistSkip: true,
        })
        // touched_grass is a vanity badge → claimable but NOT a waitlist skip
        expect(classifyBareCampaigns(['TOUCHED_GRASS'], undefined)).toEqual({
            isBareClaimCampaign: true,
            isWaitlistSkip: false,
        })
    })

    // Regression: both country-launch cohorts ship BARE links with no inviter.
    // Mapping them in UTM_CAMPAIGN_TO_BADGE_MAP alone is not enough — without a
    // bare-campaign registration the link dead-ends on "Invalid Invite Code".
    it.each(['naija', 'terere'])('country-launch campaign "%s" is a bare claimable skip', (c) => {
        expect(classifyBareCampaign(c, undefined)).toEqual({
            isBareClaimCampaign: true,
            isWaitlistSkip: true,
        })
        expect(classifyBareCampaign(c.toUpperCase(), undefined).isBareClaimCampaign).toBe(true)
    })

    it('only waitlist-skip campaigns promise a card-waitlist skip', () => {
        for (const c of BARE_VANITY_CAMPAIGNS) {
            expect(classifyBareCampaigns([c], undefined).isWaitlistSkip).toBe(false)
        }
    })

    it('a stacked link is claimable and shows skip copy when ANY campaign qualifies', () => {
        expect(classifyBareCampaigns(['TOUCHED_GRASS', 'skip'], undefined)).toEqual({
            isBareClaimCampaign: true,
            isWaitlistSkip: true,
        })
        // vanity + unknown → claimable, but no skip promise
        expect(classifyBareCampaigns(['TOUCHED_GRASS', 'SOMETHING_ELSE'], undefined)).toEqual({
            isBareClaimCampaign: true,
            isWaitlistSkip: false,
        })
    })

    it('an invite code defers to the invite flow (not bare-claimable)', () => {
        expect(classifyBareCampaigns(['TOUCHED_GRASS'], 'somecode')).toEqual({
            isBareClaimCampaign: false,
            isWaitlistSkip: false,
        })
        expect(classifyBareCampaigns(['TOUCHED_GRASS', 'skip'], 'somecode')).toEqual({
            isBareClaimCampaign: false,
            isWaitlistSkip: false,
        })
    })

    it('an unrelated or missing campaign is not bare-claimable', () => {
        expect(classifyBareCampaigns([], undefined).isBareClaimCampaign).toBe(false)
        expect(classifyBareCampaigns(['FOUNDER_HOUSE'], undefined).isBareClaimCampaign).toBe(false)
    })
})

describe('resolveCampaigns', () => {
    // The offramp migration regression this guards: ?campaign=offramp used to
    // reach /badge/award as the raw string 'offramp' and 400 (the backend matches
    // badge codes). The explicit param must resolve through the UTM map first.
    it('resolves a lowercase human-facing tag in the explicit param (?campaign=offramp)', () => {
        expect(resolveCampaigns(['offramp'], undefined, undefined)).toEqual([OFFRAMP_BADGE_CODE])
        expect(resolveCampaigns(['OFFRAMP'], undefined, undefined)).toEqual([OFFRAMP_BADGE_CODE])
    })

    it('passes an unmapped explicit param through raw (?campaign=OFFRAMP_USER)', () => {
        expect(resolveCampaigns(['OFFRAMP_USER'], undefined, undefined)).toEqual(['OFFRAMP_USER'])
        expect(resolveCampaigns(['FOUNDER_HOUSE'], undefined, undefined)).toEqual(['FOUNDER_HOUSE'])
    })

    it('documents that ?campaign=<tag> behaves exactly like ?utm_campaign=<tag>', () => {
        for (const [utmKey, badgeCode] of Object.entries(UTM_CAMPAIGN_TO_BADGE_MAP)) {
            expect(resolveCampaigns([utmKey], undefined, undefined)).toEqual([badgeCode])
            expect(resolveCampaigns([], undefined, utmKey)).toEqual([badgeCode])
        }
    })

    // Stacking: every source contributes — repeated params, comma-separated
    // values, a mapped invite code, and a mapped utm_campaign all UNION.
    it('stacks repeated params', () => {
        expect(resolveCampaigns(['skip', 'touched-grass'], undefined, undefined)).toEqual(['skip', 'TOUCHED_GRASS'])
    })

    it('stacks comma-separated values in one param', () => {
        expect(resolveCampaigns(['skip,touched-grass'], undefined, undefined)).toEqual(['skip', 'TOUCHED_GRASS'])
        // whitespace + empty segments are tolerated
        expect(resolveCampaigns([' skip , ,offramp '], undefined, undefined)).toEqual(['skip', OFFRAMP_BADGE_CODE])
    })

    it('unions explicit params with a mapped invite code and a mapped utm_campaign', () => {
        expect(resolveCampaigns(['skip'], 'alumni', 'touched-grass')).toEqual(['skip', 'EVENT_ALUMNI', 'TOUCHED_GRASS'])
    })

    it('dedupes case-insensitively across sources (first occurrence wins)', () => {
        // ?campaign=offramp and ?code=offramp resolve to the same badge → once
        expect(resolveCampaigns(['offramp'], 'offramp', 'offramp')).toEqual([OFFRAMP_BADGE_CODE])
        expect(resolveCampaigns(['skip', 'SKIP'], undefined, undefined)).toEqual(['skip'])
    })

    it('an unmapped invite code or utm_campaign contributes nothing', () => {
        expect(resolveCampaigns([], 'not-a-special-code', undefined)).toEqual([])
        expect(resolveCampaigns([], undefined, 'ordinary-marketing-utm')).toEqual([])
        expect(resolveCampaigns([], undefined, undefined)).toEqual([])
    })

    // The exact URL shape handed to a paid creator: a personal invite code for
    // the referral plus the campaign tag for the badge. The personal code is not
    // in INVITE_CODE_TO_CAMPAIGN_MAP, so the tag has to carry the badge alone.
    it('resolves a creator link that pairs a personal invite code with a campaign tag', () => {
        expect(resolveCampaigns(['nita'], 'somepersonalcode', undefined)).toEqual(['NITA'])
    })
})
