import { renderHook } from '@testing-library/react'
import { useCardSurfaceAccess } from '../useCardSurfaceAccess'
import { useCardInfo } from '../useCardInfo'
import { useRainCardOverview } from '../useRainCardOverview'
import { useResidenceRestrictions } from '../useResidenceRestrictions'

jest.mock('../useCardInfo', () => ({ useCardInfo: jest.fn() }))
jest.mock('../useRainCardOverview', () => ({ useRainCardOverview: jest.fn() }))
jest.mock('../useResidenceRestrictions', () => ({ useResidenceRestrictions: jest.fn() }))

const mockCardInfo = useCardInfo as jest.Mock
const mockOverview = useRainCardOverview as jest.Mock
const mockRestrictions = useResidenceRestrictions as jest.Mock

type Scenario = {
    hasCardAccess?: boolean
    isEligible?: boolean
    cardStatuses?: string[]
    restrictedCard?: boolean
}

const setup = (scenario: Scenario) => {
    const { hasCardAccess = false, cardStatuses = [], restrictedCard = false } = scenario
    // `in`, not a default: an explicit `isEligible: undefined` is the
    // still-loading case and a parameter default would silently rewrite it
    const isEligible = 'isEligible' in scenario ? scenario.isEligible : true
    mockCardInfo.mockReturnValue({ hasCardAccess, isEligible })
    mockOverview.mockReturnValue({ overview: { cards: cardStatuses.map((status) => ({ status })) } })
    mockRestrictions.mockReturnValue({ banking: false, card: restrictedCard })
    return renderHook(() => useCardSurfaceAccess()).result.current
}

describe('useCardSurfaceAccess', () => {
    beforeEach(() => jest.clearAllMocks())

    /*
     * The regression this pins: `hasCardAccess` is the WAITLIST inner gate
     * (`cardAccessGrantedAt` or a skip badge), stamped by
     * releaseUsersFromWaitlist with no geo check. Reading it as "holds a card"
     * offered a Peanut card to every released user resident in a
     * Rain-prohibited country — a row and a nav tab whose only destination is
     * /card's geo-blocked screen.
     */
    it('hides the surface from a waitlist-released user whose residence is card-restricted', () => {
        const access = setup({ hasCardAccess: true, isEligible: false, restrictedCard: true })
        expect(access.showCardSurface).toBe(false)
        expect(access.hasIssuedCard).toBe(false)
        // still reported: it decides WHICH door the surface opens, if shown
        expect(access.hasCardAccess).toBe(true)
    })

    it('keeps the surface for a holder whose residence is card-restricted', () => {
        const access = setup({ hasCardAccess: true, cardStatuses: ['ACTIVE'], restrictedCard: true })
        expect(access.hasIssuedCard).toBe(true)
        expect(access.showCardSurface).toBe(true)
    })

    it('treats a canceled card as no card', () => {
        const access = setup({ hasCardAccess: true, cardStatuses: ['CANCELED'], restrictedCard: true })
        expect(access.hasIssuedCard).toBe(false)
        expect(access.showCardSurface).toBe(false)
    })

    it('shows the surface to an eligible non-holder in an unrestricted residence', () => {
        expect(setup({}).showCardSurface).toBe(true)
    })

    it('hides the surface when the server says not eligible', () => {
        expect(setup({ isEligible: false }).showCardSurface).toBe(false)
    })

    it('keeps the surface while eligibility is still loading', () => {
        expect(setup({ isEligible: undefined }).showCardSurface).toBe(true)
    })

    it('hides the surface on a restricted residence before eligibility resolves', () => {
        expect(setup({ isEligible: undefined, restrictedCard: true }).showCardSurface).toBe(false)
    })
})
