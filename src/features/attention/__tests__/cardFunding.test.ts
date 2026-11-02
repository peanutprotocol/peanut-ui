/**
 * The journey's reading of the server's card funding decision (`setupPath`).
 */
import { cardSetupPath, type CardFundingInputs } from '../cardFunding'
import { buildJourneyState, type JourneyInputs } from '../journeyState'

const input = (patch: Partial<CardFundingInputs> = {}): CardFundingInputs => ({
    hasActiveCard: true,
    accessLoading: false,
    access: { fundingMode: 'managed', enrollmentAllowed: false } as CardFundingInputs['access'],
    ...patch,
})

describe('cardSetupPath', () => {
    test('none without an active card, unknown while the decision loads', () => {
        expect(cardSetupPath(input({ hasActiveCard: false }))).toBe('none')
        expect(cardSetupPath(input({ accessLoading: true, access: undefined }))).toBe('unknown')
    })

    test('a failed decision is none, never legacy', () => {
        expect(cardSetupPath(input({ access: undefined }))).toBe('none')
    })

    test('legacy only when managed funding is not open to the account', () => {
        const legacy = { fundingMode: 'legacy', enrollmentAllowed: false } as CardFundingInputs['access']
        const open = { fundingMode: 'legacy', enrollmentAllowed: true } as CardFundingInputs['access']
        expect(cardSetupPath(input({ access: legacy }))).toBe('legacy')
        expect(cardSetupPath(input({ access: open }))).toBe('managed')
    })
})

describe('buildJourneyState', () => {
    test('carries the funding decision into the card', () => {
        const state = buildJourneyState({
            cardLoaded: true,
            cardNeedsSetup: true,
            activeCardId: 'card-a',
            cardSetupPath: 'managed',
        } as JourneyInputs)
        expect(state.card).toEqual({
            loaded: true,
            needsSetup: true,
            activeCardId: 'card-a',
            setupPath: 'managed',
        })
    })
})
