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
    isPublicLaunched: true,
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

    it('still routes admin-granted users (no skip badge) through the celebration once', () => {
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ hasCardAccess: true, skipBadges: [] }),
                skipCelebrationSeen: false,
            })
        ).toBe('waitlist-skip-celebration')
    })

    it('returns add-card for admin-granted users after the celebration has been seen', () => {
        expect(
            computeCardState({
                ...base,
                overview: emptyOverview,
                cardInfo: cardInfo({ hasCardAccess: true, skipBadges: [] }),
                skipCelebrationSeen: true,
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
                overview: withApp('PENDING', 'needsVerification'),
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

    // Exhaustive over the backend RailStatus enum (peanut-api-ts prisma).
    // If the BE adds a value, add a row here — any unmapped status falls
    // through to the add-card branch, which is exactly the prod infinite
    // loop (apply → "Application already submitted" → add-card → …) that
    // hit REQUIRES_INFORMATION / FAILED / REQUIRES_SUPPORT users (2026-06-10).
    describe('maps every backend RailStatus value to a real state', () => {
        const cases: Array<{ railStatus: string; expected: string }> = [
            { railStatus: 'PENDING', expected: 'pending' },
            { railStatus: 'ENABLED', expected: 'add-card' },
            { railStatus: 'REQUIRES_INFORMATION', expected: 'requires-info' },
            { railStatus: 'REQUIRES_EXTRA_INFORMATION', expected: 'requires-info' },
            { railStatus: 'REQUIRES_SUPPORT', expected: 'requires-support' },
            { railStatus: 'REJECTED', expected: 'rejected' },
            { railStatus: 'FAILED', expected: 'rejected' },
        ]

        it.each(cases)('$railStatus → $expected', ({ railStatus, expected }) => {
            expect(
                computeCardState({
                    ...base,
                    overview: withApp(railStatus),
                    cardInfo: cardInfo({ hasCardAccess: true }),
                    skipCelebrationSeen: true,
                })
            ).toBe(expected)
        })

        const failureStatuses = [
            'REQUIRES_INFORMATION',
            'REQUIRES_EXTRA_INFORMATION',
            'REQUIRES_SUPPORT',
            'REJECTED',
            'FAILED',
        ]

        it.each(failureStatuses)('%s never resolves to add-card (infinite-loop regression)', (railStatus) => {
            expect(
                computeCardState({
                    ...base,
                    overview: withApp(railStatus),
                    cardInfo: cardInfo({ hasCardAccess: true }),
                    skipCelebrationSeen: true,
                })
            ).not.toBe('add-card')
        })

        it('routes an UNKNOWN future railStatus to requires-support, never add-card (default-deny)', () => {
            // A new backend RailStatus value must not silently fall through
            // to add-card — an application exists, so re-applying would
            // re-create the same infinite loop for the unknown state.
            expect(
                computeCardState({
                    ...base,
                    overview: withApp('SOME_FUTURE_STATUS' as never),
                    cardInfo: cardInfo({ hasCardAccess: true }),
                    skipCelebrationSeen: true,
                })
            ).toBe('requires-support')
        })
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
