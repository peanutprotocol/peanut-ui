import type { CardInfoResponse } from '@/services/card'
import type { RainCardOverview } from '@/services/rain'
import { computeCardState } from '@/components/Card/cardState.utils'

const cardInfo = (overrides: Partial<CardInfoResponse> = {}): CardInfoResponse => ({ isEligible: true, ...overrides })
const emptyOverview: RainCardOverview = { status: { hasApplication: false }, balance: null, cards: [] }
const withApp = (railStatus: string, applicationStatus?: string): RainCardOverview => ({
    ...emptyOverview,
    status: { hasApplication: true, railStatus, applicationStatus },
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
            status,
            network: 'visa',
            issuedAt: '2026-09-09T00:00:00Z',
            hasWithdrawApproval: false,
        },
    ],
})
const base = { overviewLoading: false, cardInfoLoading: false, overview: emptyOverview, cardInfo: cardInfo() }

describe('public card application state', () => {
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

    it.each(['needsVerification', 'needsInformation', 'locked'])('preserves manual review for %s', (status) => {
        expect(computeCardState({ ...base, overview: withApp('PENDING', status) })).toBe('manual-review')
    })

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
