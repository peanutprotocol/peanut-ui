import { cardOfferFacts } from '@/features/attention/journeyState'
import { cardOffer } from '@/features/attention/registry'
import type { JourneyState } from '@/features/attention/types'
import { renderHook } from '@testing-library/react'
import { useCardSurfaceAccess } from '../useCardSurfaceAccess'
import { useCardInfo } from '../useCardInfo'
import { useCapabilities } from '../useCapabilities'
import { useResidenceRestrictions } from '../useResidenceRestrictions'
import { useIdentityVerification } from '../useIdentityVerification'

jest.mock('../useCardInfo', () => ({ useCardInfo: jest.fn() }))
jest.mock('../useCapabilities', () => ({ useCapabilities: jest.fn() }))
jest.mock('../useResidenceRestrictions', () => ({ useResidenceRestrictions: jest.fn() }))
jest.mock('../useIdentityVerification', () => ({ useIdentityVerification: jest.fn() }))

const setup = (
    scenario: {
        geoProhibited?: boolean
        cardStatuses?: string[]
        restrictedCard?: boolean
        hasApplication?: boolean
        /** the Rain application rail's own status (rejected/failed = blocked) */
        applicationStatus?: 'pending' | 'requires-info' | 'blocked'
        identityFailed?: boolean
        loading?: boolean
    } = {}
) => {
    ;(useIdentityVerification as jest.Mock).mockReturnValue({ isTerminalFailure: scenario.identityFailed ?? false })
    ;(useCardInfo as jest.Mock).mockReturnValue({
        cardInfo: scenario.loading ? undefined : { geoProhibited: scenario.geoProhibited },
    })
    const rails: Array<{
        id: string
        channel: string
        status: string
        operations?: { pay: string }
    }> = (scenario.cardStatuses ?? []).map((status, index) => ({
        id: `rain.card_${index}`,
        channel: 'card',
        // Rain's application rail stays enabled even after card cancellation;
        // the operation refinement is the card-level truth.
        status: 'enabled',
        operations: { pay: status === 'ACTIVE' ? 'enabled' : 'blocked' },
    }))
    if (scenario.hasApplication) rails.push({ id: 'rain.card_application', channel: 'card', status: 'pending' })
    if (scenario.applicationStatus)
        rails.push({ id: 'rain.card_rain', channel: 'card', status: scenario.applicationStatus })
    ;(useCapabilities as jest.Mock).mockReturnValue({
        rails,
        channelOf: (rail: { channel: string }) => rail.channel,
    })
    ;(useResidenceRestrictions as jest.Mock).mockReturnValue({ card: scenario.restrictedCard ?? false })
    return renderHook(() => useCardSurfaceAccess()).result.current
}

test('failed card info must not offer an unconfirmed card', () => {
    const access = setup({ loading: true }) // no returned cardInfo; same hook input after final error
    const cardInfo = undefined
    const cardInfoLoading = false
    const cardInfoError = new Error('offline')
    // Exact journeyState 313-318 projection, with the real access hook above.
    const state = {
        userId: 'a',
        userLoaded: true,
        activated: true,
        cardOffer: cardOfferFacts({
            loading: cardInfoLoading,
            cardInfo,
            error: cardInfoError,
            showCardSurface: access.showCardSurface,
            hasCardRelationship: false,
            promotionDisabled: false,
        }),
    } as JourneyState
    expect(cardOffer.eligible(state)).toBe('ineligible')
})
