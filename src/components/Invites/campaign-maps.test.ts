import { BADGES } from '@/components/Badges/badge.utils'
import {
    INVITE_CODE_TO_CAMPAIGN_MAP,
    UTM_CAMPAIGN_TO_BADGE_MAP,
    WAITLIST_SKIP_CAMPAIGNS,
    BARE_VANITY_CAMPAIGNS,
    OFFRAMP_BADGE_CODE,
    classifyBareCampaign,
    resolveCampaign,
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

describe('classifyBareCampaign', () => {
    // A bare campaign (no invite code) must be claimable, or /invite dead-ends at
    // the "Invalid Invite Code" screen. This is the bug that left touched_grass
    // unclaimable — it was never registered as a bare campaign.
    it.each([...WAITLIST_SKIP_CAMPAIGNS, ...BARE_VANITY_CAMPAIGNS])(
        'campaign "%s" is bare-claimable with no invite code',
        (campaign) => {
            expect(classifyBareCampaign(campaign, undefined).isBareClaimCampaign).toBe(true)
        }
    )

    it('classifies waitlist-skip vs vanity, case-insensitively', () => {
        // event_alumni skips the card waitlist → skip copy
        expect(classifyBareCampaign('EVENT_ALUMNI', undefined)).toEqual({
            isBareClaimCampaign: true,
            isWaitlistSkip: true,
        })
        // touched_grass is a vanity badge → claimable but NOT a waitlist skip
        expect(classifyBareCampaign('TOUCHED_GRASS', undefined)).toEqual({
            isBareClaimCampaign: true,
            isWaitlistSkip: false,
        })
    })

    it('only waitlist-skip campaigns promise a card-waitlist skip', () => {
        for (const c of BARE_VANITY_CAMPAIGNS) {
            expect(classifyBareCampaign(c, undefined).isWaitlistSkip).toBe(false)
        }
    })

    it('an invite code defers to the invite flow (not bare-claimable)', () => {
        expect(classifyBareCampaign('TOUCHED_GRASS', 'somecode')).toEqual({
            isBareClaimCampaign: false,
            isWaitlistSkip: false,
        })
    })

    it('an unrelated or missing campaign is not bare-claimable', () => {
        expect(classifyBareCampaign(undefined, undefined).isBareClaimCampaign).toBe(false)
        expect(classifyBareCampaign('FOUNDER_HOUSE', undefined).isBareClaimCampaign).toBe(false)
    })
})

describe('resolveCampaign', () => {
    // The offramp migration regression this guards: ?campaign=offramp used to
    // reach /badge/award as the raw string 'offramp' and 400 (the backend matches
    // badge codes). The explicit param must resolve through the UTM map first.
    it('resolves a lowercase human-facing tag in the explicit param (?campaign=offramp)', () => {
        expect(resolveCampaign('offramp', undefined, undefined)).toBe(OFFRAMP_BADGE_CODE)
        expect(resolveCampaign('OFFRAMP', undefined, undefined)).toBe(OFFRAMP_BADGE_CODE)
    })

    it('passes an unmapped explicit param through raw (?campaign=OFFRAMP_USER)', () => {
        expect(resolveCampaign('OFFRAMP_USER', undefined, undefined)).toBe('OFFRAMP_USER')
        expect(resolveCampaign('FOUNDER_HOUSE', undefined, undefined)).toBe('FOUNDER_HOUSE')
    })

    it('documents that ?campaign=<tag> behaves exactly like ?utm_campaign=<tag>', () => {
        for (const [utmKey, badgeCode] of Object.entries(UTM_CAMPAIGN_TO_BADGE_MAP)) {
            expect(resolveCampaign(utmKey, undefined, undefined)).toBe(badgeCode)
            expect(resolveCampaign(undefined, undefined, utmKey)).toBe(badgeCode)
        }
    })

    it('explicit param wins over invite code and utm_campaign', () => {
        expect(resolveCampaign('offramp', 'alumni', 'touched-grass')).toBe(OFFRAMP_BADGE_CODE)
    })

    it('invite code wins over utm_campaign when there is no explicit param', () => {
        expect(resolveCampaign(undefined, 'offramp', 'touched-grass')).toBe(OFFRAMP_BADGE_CODE)
    })

    it('falls back to utm_campaign, and to undefined when nothing resolves', () => {
        expect(resolveCampaign(undefined, undefined, 'offramp')).toBe(OFFRAMP_BADGE_CODE)
        expect(resolveCampaign(undefined, 'not-a-special-code', undefined)).toBeUndefined()
        expect(resolveCampaign(null, undefined, undefined)).toBeUndefined()
    })
})
