import type { CardInfoResponse } from '@/services/card'
import type { RainCardOverview } from '@/services/rain'
import { computeCardState } from '@/components/Card/cardState.utils'
import type { ServedCardState } from '@/components/Card/servedCardState'
import type { RailStatus, RainCardStatus } from '@/constants/api-enums.generated'

const cardInfo = (overrides: Partial<CardInfoResponse> = {}): CardInfoResponse => ({ isEligible: true, ...overrides })
const emptyOverview: RainCardOverview = { status: { hasApplication: false }, balance: null, cards: [] }
// Takes any string: some cases pin how a status the API may add later reads.
const withApp = (railStatus: string, applicationStatus?: string): RainCardOverview => ({
    ...emptyOverview,
    status: { hasApplication: true, railStatus: railStatus as RailStatus, applicationStatus },
})
const withCard = (status: string): RainCardOverview => ({
    ...withApp('ENABLED'),
    cards: [
        {
            id: 'c1',
            rainCardId: 'r1',
            last4: '0420',
            expiryMonth: 6,
            expiryYear: 2069,
            status: status as RainCardStatus,
            network: 'visa',
            issuedAt: '2026-09-09T00:00:00Z',
            hasWithdrawApproval: false,
        },
    ],
})
const base = { overviewLoading: false, cardInfoLoading: false, overview: emptyOverview, cardInfo: cardInfo() }

// These fixtures carry no `cardState`: they pin the fallback for an API before peanut-api-ts#2238.
describe('public card application state (fallback derivation)', () => {
    it('waits for the application and geography queries', () => {
        expect(computeCardState({ ...base, overviewLoading: true })).toBe('loading')
        expect(computeCardState({ ...base, cardInfoLoading: true })).toBe('loading')
        expect(computeCardState({ ...base, cardInfo: undefined })).toBe('loading')
    })

    it('opens an ordinary new account directly at the application', () => {
        expect(computeCardState(base)).toBe('add-card')
    })

    it('allows an unknown residence to start verification before funding', () => {
        expect(computeCardState({ ...base, cardInfo: cardInfo({ isEligible: false, geoProhibited: false }) })).toBe(
            'add-card'
        )
        expect(emptyOverview.balance).toBeNull()
    })

    it('ignores old access and waitlist fields left on a cached API response', () => {
        const legacyInfo = {
            ...cardInfo(),
            hasCardAccess: false,
            flowEarlyAccess: false,
            isPublicLaunched: false,
            skipBadges: [],
            waitlistJoinedAt: '2026-08-01T00:00:00Z',
        }
        expect(computeCardState({ ...base, cardInfo: legacyInfo })).toBe('add-card')
    })

    it.each(['ACTIVE', 'LOCKED', 'PENDING'])('keeps an issued %s card accessible', (status) => {
        expect(
            computeCardState({ ...base, overview: withCard(status), cardInfo: cardInfo({ geoProhibited: true }) })
        ).toBe('active')
    })

    it('allows a canceled card to be reissued through the normal application', () => {
        expect(computeCardState({ ...base, overview: withCard('CANCELED') })).toBe('add-card')
    })

    it.each([
        ['PENDING', 'pending'],
        ['ENABLED', 'add-card'],
        ['REQUIRES_INFORMATION', 'requires-info'],
        ['REQUIRES_EXTRA_INFORMATION', 'requires-info'],
        ['REQUIRES_SUPPORT', 'requires-support'],
        ['REJECTED', 'rejected'],
        ['FAILED', 'rejected'],
        ['FUTURE_STATUS', 'requires-support'],
    ])('preserves %s application state', (status, expected) => {
        expect(computeCardState({ ...base, overview: withApp(status) })).toBe(expected)
    })

    it.each(['needsVerification', 'needsInformation', 'locked', 'manualReview'])(
        'preserves manual review for %s',
        (status) => {
            expect(computeCardState({ ...base, overview: withApp('PENDING', status) })).toBe('manual-review')
        }
    )

    it('blocks a known prohibited residence before starting an application', () => {
        expect(computeCardState({ ...base, cardInfo: cardInfo({ isEligible: false, geoProhibited: true }) })).toBe(
            'geo-blocked'
        )
    })

    it.each([
        ['PENDING', 'pending'],
        ['REJECTED', 'rejected'],
        ['ENABLED', 'add-card'],
    ])('preserves %s provider state when residence becomes prohibited', (status, expected) => {
        expect(
            computeCardState({ ...base, overview: withApp(status), cardInfo: cardInfo({ geoProhibited: true }) })
        ).toBe(expected)
    })
})

const SERVED_STATES: ServedCardState[] = [
    'add-card',
    'creating-card',
    'pending',
    'manual-review',
    'requires-info',
    'requires-support',
    'rejected',
    'active',
]
const RAILS = [undefined, 'PENDING', 'ENABLED', 'REQUIRES_INFORMATION', 'REQUIRES_SUPPORT', 'REJECTED', 'FAILED']
const CARD_ROWS = [[], ['ACTIVE'], ['LOCKED'], ['NOT_ACTIVATED'], ['CANCELED'], ['CANCELED', 'ACTIVE']]

describe('served card state', () => {
    it('returns the served state over every cohort, laying only geo-blocked over a rail-less add-card', () => {
        for (const served of SERVED_STATES)
            for (const railStatus of RAILS)
                for (const statuses of CARD_ROWS)
                    for (const geoProhibited of [false, true]) {
                        const overview: RainCardOverview = {
                            ...withApp(railStatus ?? ''),
                            status: { hasApplication: railStatus !== undefined, railStatus },
                            cards: statuses.map((status) => ({ ...withCard(status).cards[0], status })),
                            cardState: served,
                        }
                        const expected = served === 'add-card' && !railStatus && geoProhibited ? 'geo-blocked' : served
                        expect(computeCardState({ ...base, overview, cardInfo: cardInfo({ geoProhibited }) })).toBe(
                            expected
                        )
                    }
    })

    it('reads a first card on its way as creating-card, where the fallback said add-card', () => {
        const approvedEmpty = withApp('ENABLED', 'approved')
        expect(computeCardState({ ...base, overview: approvedEmpty })).toBe('add-card')
        expect(computeCardState({ ...base, overview: { ...approvedEmpty, cardState: 'creating-card' } })).toBe(
            'creating-card'
        )
    })

    it('keeps the loading gate in front of the served state', () => {
        const overview = { ...emptyOverview, cardState: 'active' as const }
        expect(computeCardState({ ...base, overview, overviewLoading: true })).toBe('loading')
        expect(computeCardState({ ...base, overview, cardInfo: undefined })).toBe('loading')
    })
})
