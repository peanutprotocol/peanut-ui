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

describe('public card surfaces', () => {
    it('opens /card for an ordinary signup with unknown residence', () => {
        expect(setup()).toMatchObject({ showCardSurface: true, cardHref: '/card', hasIssuedCard: false })
    })
    it('keeps the card entry available while geography loads', () => {
        expect(setup({ loading: true }).showCardSurface).toBe(true)
    })
    it('withholds the spend promise while geography loads, unless a card is issued', () => {
        // loading must not read as "not prohibited" — no spend-arm flash
        expect(setup({ loading: true }).canSpendPathViaCard).toBe(false)
        expect(setup({ loading: true, cardStatuses: ['ACTIVE'] }).canSpendPathViaCard).toBe(true)
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
            // an issued card can spend regardless of residence
            canSpendPathViaCard: true,
        })
        expect(setup({ hasApplication: true, geoProhibited: true, restrictedCard: true })).toMatchObject({
            showCardSurface: true,
            hasCardRelationship: true,
            // the surface stays (watch the application), but no spend promise —
            // a prohibited residence's pending application cannot issue
            canSpendPathViaCard: false,
        })
    })
    it('offers the card spend path to anyone who can still obtain a card', () => {
        expect(setup().canSpendPathViaCard).toBe(true)
        expect(setup({ geoProhibited: true }).canSpendPathViaCard).toBe(false)
    })
    it('does not treat a canceled card as issued when its application rail stays enabled', () => {
        expect(setup({ cardStatuses: ['CANCELED'], restrictedCard: true })).toMatchObject({
            showCardSurface: true,
            hasCardRelationship: true,
            hasIssuedCard: false,
            canSpendPathViaCard: false,
        })
    })
    it.each(['LOCKED', 'NOT_ACTIVATED'])('keeps a %s card manageable without promising spend', (status) => {
        expect(setup({ cardStatuses: [status], restrictedCard: true })).toMatchObject({
            showCardSurface: true,
            hasCardRelationship: true,
            hasIssuedCard: false,
            canSpendPathViaCard: false,
        })
    })
    it.each(['blocked', 'requires-info'] as const)(
        'a %s card application is a relationship, not a held card and not a spend path',
        (applicationStatus) => {
            expect(setup({ applicationStatus })).toMatchObject({
                // /card still shows the application's status
                showCardSurface: true,
                hasCardRelationship: true,
                holdsCardOrApplication: false,
                canSpendPathViaCard: false,
            })
        }
    )
    it('a pending application is held and stays a spend path', () => {
        expect(setup({ applicationStatus: 'pending' })).toMatchObject({
            holdsCardOrApplication: true,
            canSpendPathViaCard: true,
        })
    })
    it('an ID check that ended on a final decision is no card spend path, unless a card is issued', () => {
        expect(setup({ identityFailed: true }).canSpendPathViaCard).toBe(false)
        expect(setup({ identityFailed: true, cardStatuses: ['ACTIVE'] }).canSpendPathViaCard).toBe(true)
    })
})
