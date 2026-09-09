import { renderHook } from '@testing-library/react'
import { useCardSurfaceAccess } from '../useCardSurfaceAccess'
import { useCardInfo } from '../useCardInfo'
import { useRainCardOverview } from '../useRainCardOverview'
import { useResidenceRestrictions } from '../useResidenceRestrictions'

jest.mock('../useCardInfo', () => ({ useCardInfo: jest.fn() }))
jest.mock('../useRainCardOverview', () => ({ useRainCardOverview: jest.fn() }))
jest.mock('../useResidenceRestrictions', () => ({ useResidenceRestrictions: jest.fn() }))

const setup = (
    scenario: {
        geoProhibited?: boolean
        cardStatuses?: string[]
        restrictedCard?: boolean
        hasApplication?: boolean
        loading?: boolean
    } = {}
) => {
    ;(useCardInfo as jest.Mock).mockReturnValue({
        cardInfo: scenario.loading ? undefined : { geoProhibited: scenario.geoProhibited },
    })
    ;(useRainCardOverview as jest.Mock).mockReturnValue({
        overview: {
            cards: (scenario.cardStatuses ?? []).map((status) => ({ status })),
            status: { hasApplication: scenario.hasApplication ?? false },
        },
    })
    ;(useResidenceRestrictions as jest.Mock).mockReturnValue({ card: scenario.restrictedCard ?? false })
    return renderHook(() => useCardSurfaceAccess()).result.current
}

describe('public card surfaces', () => {
    it('opens /card for an ordinary signup with unknown residence', () => {
        expect(setup()).toMatchObject({ showCardSurface: true, cardHref: '/card', hasIssuedCard: false })
    })
    it('keeps the card entry available while geography loads', () => {
        expect(setup({ loading: true }).showCardSurface).toBe(true)
    })
    it.each([{ geoProhibited: true }, { restrictedCard: true }])(
        'hides a known prohibited residence: %p',
        (scenario) => {
            expect(setup(scenario).showCardSurface).toBe(false)
        }
    )
    it('preserves existing holders and applications in a prohibited residence', () => {
        expect(setup({ cardStatuses: ['ACTIVE'], geoProhibited: true, restrictedCard: true })).toMatchObject({
            showCardSurface: true,
            hasIssuedCard: true,
        })
        expect(setup({ hasApplication: true, geoProhibited: true, restrictedCard: true })).toMatchObject({
            showCardSurface: true,
            hasCardRelationship: true,
        })
    })
    it('does not treat a canceled card as an active card', () => {
        expect(setup({ cardStatuses: ['CANCELED'], restrictedCard: true })).toMatchObject({
            showCardSurface: false,
            hasIssuedCard: false,
        })
    })
})
