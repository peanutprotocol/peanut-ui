import type { CardInfoResponse } from '@/services/card'
import type { RainCardOverview } from '@/services/rain'
import { computeCardState } from '@/components/Card/cardState.utils'

const pioneer = (opts: { hasPurchased?: boolean; hasCardAccess?: boolean } = {}): CardInfoResponse => ({
    hasPurchased: opts.hasPurchased ?? false,
    hasCardAccess: opts.hasCardAccess ?? opts.hasPurchased ?? false,
    isEligible: true,
    price: 10,
    currentTier: 0,
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

describe('computeCardState', () => {
    it('returns loading while either query is loading', () => {
        expect(
            computeCardState({
                overview: undefined,
                pioneerInfo: undefined,
                overviewLoading: true,
                pioneerLoading: false,
            })
        ).toBe('loading')
    })

    it('returns pioneer when user has not purchased and no application', () => {
        expect(
            computeCardState({
                overview: emptyOverview,
                pioneerInfo: pioneer({ hasPurchased: false }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('pioneer')
    })

    it('returns add-card when purchased but no application yet', () => {
        expect(
            computeCardState({
                overview: emptyOverview,
                pioneerInfo: pioneer({ hasPurchased: true }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('add-card')
    })

    it('returns add-card when manually granted access without Pioneer purchase', () => {
        expect(
            computeCardState({
                overview: emptyOverview,
                pioneerInfo: pioneer({ hasPurchased: false, hasCardAccess: true }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('add-card')
    })

    it('returns pending when application is PENDING', () => {
        expect(
            computeCardState({
                overview: withApp('PENDING', 'pending'),
                pioneerInfo: pioneer({ hasPurchased: true }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('pending')
    })

    it('returns manual-review when Rain flags needsVerification', () => {
        expect(
            computeCardState({
                overview: withApp('PENDING', 'needsVerification'),
                pioneerInfo: pioneer({ hasPurchased: true }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('manual-review')
    })

    it('returns rejected when railStatus is REJECTED', () => {
        expect(
            computeCardState({
                overview: withApp('REJECTED', 'denied'),
                pioneerInfo: pioneer({ hasPurchased: true }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('rejected')
    })

    it('returns active when a non-canceled card exists', () => {
        expect(
            computeCardState({
                overview: withCard('ACTIVE'),
                pioneerInfo: pioneer({ hasPurchased: true }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('active')
    })

    it('routes to add-card when the only card is CANCELED (user can re-apply)', () => {
        expect(
            computeCardState({
                overview: withCard('CANCELED'),
                pioneerInfo: pioneer({ hasPurchased: true }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('add-card')
    })

    it('stays pending only when railStatus is PENDING (not ENABLED)', () => {
        const overview: import('@/services/rain').RainCardOverview = {
            status: { hasApplication: true, railStatus: 'ENABLED' },
            balance: null,
            cards: [],
        }
        expect(
            computeCardState({
                overview,
                pioneerInfo: pioneer({ hasPurchased: true }),
                overviewLoading: false,
                pioneerLoading: false,
            })
        ).toBe('add-card')
    })
})
