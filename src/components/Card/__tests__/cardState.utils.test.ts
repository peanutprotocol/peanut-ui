import type { CardInfoResponse } from '@/services/card'
import type { RainCardOverview } from '@/services/rain'
import { computeCardState } from '@/components/Card/cardState.utils'

const cardInfo = (
    opts: {
        hasCardAccess?: boolean
        flowEarlyAccess?: boolean
        waitlistJoinedAt?: string | null
        waitlistPosition?: number | null
        waitlistReleasedAt?: string | null
        skipBadges?: string[]
    } = {}
): CardInfoResponse => ({
    hasCardAccess: opts.hasCardAccess ?? false,
    isEligible: true,
    flowEarlyAccess: opts.flowEarlyAccess ?? true,
    waitlistJoinedAt: opts.waitlistJoinedAt ?? null,
    waitlistPosition: opts.waitlistPosition ?? null,
    waitlistReleasedAt: opts.waitlistReleasedAt ?? null,
    skipBadges: opts.skipBadges ?? [],
})

const emptyOverview: RainCardOverview = {
    status: { hasApplication: false },
    balance: null,
    cards: [],
}

const withApp = (railStatus: string, applicationStatus?: string): RainCardOverview => ({
    status: { hasApplication: true, railStatus, applicationStatus },
    balance: null,
    cards: [],
})

const withCard = (status: string): RainCardOverview => ({
    status: { hasApplication: true, railStatus: 'ENABLED' },
    balance: null,
    cards: [
        {
            id: 'c1',
            rainCardId: 'r1',
            last4: '0420',
            expiryMonth: 6,
            expiryYear: 2069,
            status,
            network: 'visa',
            issuedAt: new Date().toISOString(),
            hasWithdrawApproval: false,
        },
    ],
})

const base = {
    overviewLoading: false,
    cardInfoLoading: false,
    skipCelebrationSeen: false,
    // Tests pre-date the eligibility-check screen; default to "done" so they
    // exercise the post-check precedence as before. A dedicated test below
    // covers the eligibility-check state itself.
    eligibilityCheckDone: true,
}

describe('computeCardState', () => {
    it('returns loading while either query is loading', () => {
        expect(
            computeCardState({
                ...base,
                overview: undefined,
                cardInfo: undefined,
                overviewLoading: true,
            })
        ).toBe('loading')
    })

    it('returns no-flow-access when outer gate is closed', () => {
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ flowEarlyAccess: false }),
            })
        ).toBe('no-flow-access')
    })

    it('returns waitlist when user has flow access but no card access', () => {
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ hasCardAccess: false }),
            })
        ).toBe('waitlist')
    })

    it('returns waitlist-skip-celebration when user has a skip badge AND has not seen the celebration', () => {
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ hasCardAccess: true, skipBadges: ['OG_2025_10_12'] }),
                skipCelebrationSeen: false,
            })
        ).toBe('waitlist-skip-celebration')
    })

    it('returns add-card after the user has acknowledged the skip-badge celebration', () => {
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ hasCardAccess: true, skipBadges: ['OG_2025_10_12'] }),
                skipCelebrationSeen: true,
            })
        ).toBe('add-card')
    })

    it('returns add-card when user has access via admin grant (no skip badge)', () => {
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ hasCardAccess: true, skipBadges: [] }),
            })
        ).toBe('add-card')
    })

    it('returns pending while a rail application is in flight', () => {
        expect(
            computeCardState({
                ...base,
                overview: withApp('PENDING'),
                cardInfo: cardInfo({ hasCardAccess: true }),
            })
        ).toBe('pending')
    })

    it('returns manual-review when application needs verification', () => {
        expect(
            computeCardState({
                ...base,
                overview: withApp('IN_REVIEW', 'needsVerification'),
                cardInfo: cardInfo({ hasCardAccess: true }),
            })
        ).toBe('manual-review')
    })

    it('returns rejected on terminal Rain denial', () => {
        expect(
            computeCardState({
                ...base,
                overview: withApp('REJECTED'),
                cardInfo: cardInfo({ hasCardAccess: true }),
            })
        ).toBe('rejected')
    })

    it('returns active when a non-canceled card exists', () => {
        expect(
            computeCardState({
                ...base,
                overview: withCard('ACTIVE'),
                cardInfo: cardInfo({ hasCardAccess: true }),
            })
        ).toBe('active')
    })

    it('skips canceled cards when determining active state', () => {
        expect(
            computeCardState({
                ...base,
                overview: withCard('CANCELED'),
                cardInfo: cardInfo({ hasCardAccess: false }),
            })
        ).toBe('waitlist')
    })

    it('returns eligibility-check when user just arrived from /shhhhh and has not held the gate yet', () => {
        // Default base.eligibilityCheckDone=true would skip this state — we
        // explicitly flip it to false to model first-arrival.
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ hasCardAccess: false }),
                eligibilityCheckDone: false,
            })
        ).toBe('eligibility-check')
    })

    it('eligibility-check NOT shown for users with existing access who already cleared the gate', () => {
        // Once eligibilityCheckDone is true, the state machine flows past it.
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ hasCardAccess: true, skipBadges: ['OG_2025_10_12'] }),
                eligibilityCheckDone: true,
                skipCelebrationSeen: false,
            })
        ).toBe('waitlist-skip-celebration')
    })

    it('returns active even when flowEarlyAccess is false (legacy card-holder regression)', () => {
        // Pioneers + admin-granted users got their cards before /shhhhh
        // existed and therefore lack a flowEarlyAccess stamp. Active-card
        // check MUST win over the outer-gate redirect — otherwise they get
        // bounced to /shhhhh on every visit and can't reach YourCardScreen.
        expect(
            computeCardState({
                ...base,
                overview: withCard('ACTIVE'),
                cardInfo: cardInfo({ hasCardAccess: true, flowEarlyAccess: false }),
            })
        ).toBe('active')
    })
})
