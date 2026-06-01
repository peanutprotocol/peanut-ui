import { BADGES } from '@/components/Badges/badge.utils'
import { INVITE_CODE_TO_CAMPAIGN_MAP, UTM_CAMPAIGN_TO_BADGE_MAP } from './campaign-maps'

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
