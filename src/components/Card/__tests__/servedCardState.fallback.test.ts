import type { CardInfoResponse } from '@/services/card'
import type { RainCardOverview } from '@/services/rain'
import { computeCardState } from '@/components/Card/cardState.utils'
import { servedCardState } from '@/components/Card/servedCardState'

/**
 * An API without `cardState` (an older API during a deploy or a rollback) must get today's derivation back.
 * The frozen copies below are the app's code before ui#4209 (feat/state-machines-wave-2 @ 242f55b07). Do not edit.
 */
function frozenComputeCardState(overview: RainCardOverview, cardInfo: CardInfoResponse): string {
    if (overview.cards.some((c) => c.status !== 'CANCELED')) return 'active'
    const rail = overview.status.railStatus
    const app = overview.status.applicationStatus
    if (rail === 'REJECTED' || rail === 'FAILED') return 'rejected'
    if (rail === 'REQUIRES_SUPPORT') return 'requires-support'
    if (rail === 'REQUIRES_INFORMATION' || rail === 'REQUIRES_EXTRA_INFORMATION') return 'requires-info'
    if (rail === 'PENDING') {
        if (app === 'needsVerification' || app === 'needsInformation' || app === 'locked' || app === 'manualReview') {
            return 'manual-review'
        }
        return 'pending'
    }
    if (rail && rail !== 'ENABLED') return 'requires-support'
    if (!rail && cardInfo.geoProhibited) return 'geo-blocked'
    return 'add-card'
}

/** useCardFlow `finishIssuanceWait` before ui#4209: when the wait ends in "issue failed". */
const frozenIssueFailed = (overview: RainCardOverview): boolean =>
    !!overview.status.hasApplication &&
    overview.status.railStatus === 'ENABLED' &&
    overview.cards.every((card) => card.status === 'CANCELED')

const RAILS = [
    undefined,
    'PENDING',
    'ENABLED',
    'REQUIRES_INFORMATION',
    'REQUIRES_EXTRA_INFORMATION',
    'REQUIRES_SUPPORT',
    'REJECTED',
    'FAILED',
    'SOMETHING_NEW',
]
const APPS = [undefined, 'approved', 'pending', 'needsVerification', 'needsInformation', 'locked', 'manualReview']
const CARD_SETS = [
    [],
    ['ACTIVE'],
    ['LOCKED'],
    ['NOT_ACTIVATED'],
    ['CANCELED'],
    ['CANCELED', 'CANCELED'],
    ['CANCELED', 'ACTIVE'],
]

const card = (status: string, i: number) => ({
    id: `c${i}`,
    rainCardId: `r${i}`,
    last4: '0420',
    expiryMonth: 6,
    expiryYear: 2069,
    status,
    network: 'visa',
    issuedAt: '2026-09-09T00:00:00Z',
    hasWithdrawApproval: false,
})

const cells = RAILS.flatMap((railStatus) =>
    APPS.flatMap((applicationStatus) =>
        CARD_SETS.flatMap((statuses) =>
            [false, true].map((geoProhibited) => ({
                // the API sends hasApplication exactly when a Rain rail row exists (routes/rain/helpers.ts)
                overview: {
                    status: { hasApplication: railStatus !== undefined, railStatus, applicationStatus },
                    balance: null,
                    cards: statuses.map(card),
                } as RainCardOverview,
                cardInfo: { isEligible: true, geoProhibited } as CardInfoResponse,
            }))
        )
    )
)

describe('servedCardState without cardState: the derivation from before ui#4209', () => {
    it('covers the whole matrix', () => {
        expect(cells).toHaveLength(RAILS.length * APPS.length * CARD_SETS.length * 2)
    })

    it('computeCardState answers as before in every cell', () => {
        const changed = cells.filter(
            ({ overview, cardInfo }) =>
                computeCardState({ overview, cardInfo, overviewLoading: false, cardInfoLoading: false }) !==
                frozenComputeCardState(overview, cardInfo)
        )
        expect(changed).toEqual([])
    })

    it('the issuance wait ends in "issue failed" exactly where it did before', () => {
        // finishIssuanceWait fails the issue on a served add-card with an application (useCardFlow.ts)
        const changed = cells.filter(
            ({ overview }) =>
                (servedCardState(overview) === 'add-card' && !!overview.status.hasApplication) !==
                frozenIssueFailed(overview)
        )
        expect(changed).toEqual([])
    })
})
