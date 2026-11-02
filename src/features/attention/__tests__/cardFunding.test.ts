/**
 * The journey's reading of card funding: the server's decision (`setupPath`)
 * and FundingSetupPrompt's own show rule, computed from the same inputs the
 * prompt reads, plus what the prompt holds while it is open.
 */
import {
    cardFundingState,
    cardSetupPath,
    getFundingPromptHold,
    resetFundingPromptHoldsForTests,
    setFundingPromptHold,
    type CardFundingInputs,
    type FundingStateInputs,
} from '../cardFunding'
import { buildJourneyState, type JourneyInputs } from '../journeyState'
import type { RainCardFunding, RainCardOverview } from '@/services/rain'

const funding = (status: string, reason: string | null = null, authorizationText = 'I authorize') =>
    ({ management: { status, reason }, permission: { authorizationText } }) as unknown as RainCardFunding

const overview = (spendingPower = 0) =>
    ({
        cards: [{ id: 'card-a', status: 'ACTIVE' }],
        status: {},
        balance: { spendingPower },
        balanceUnavailable: false,
    }) as unknown as RainCardOverview

const NO_HOLD = { owesReturn: false, returnError: false, endedForGood: false }

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

const state = (patch: Partial<FundingStateInputs> = {}): FundingStateInputs => ({
    ...input(),
    fundingLoading: false,
    funding: funding('required'),
    overview: overview(),
    hold: NO_HOLD,
    ...patch,
})

beforeEach(() => resetFundingPromptHoldsForTests())

describe('cardFundingState: needsFunding mirrors the prompt', () => {
    test('undefined while the funding state loads', () => {
        expect(cardFundingState(state({ fundingLoading: true, funding: undefined })).needsFunding).toBeUndefined()
    })

    test.each([
        ['required', null, true],
        ['migration_required', null, true],
        ['pending', null, true],
        ['temporarily_unavailable', 'withdrawal_in_flight', true],
        ['ready', null, false],
        ['temporarily_unavailable', null, false],
        ['required', 'scope_retired', false],
    ])('status %s (reason %s) → %s', (status, reason, expected) => {
        expect(cardFundingState(state({ funding: funding(status, reason) })).needsFunding).toBe(expected)
    })

    test('a failed funding read shows nothing', () => {
        expect(cardFundingState(state({ funding: undefined })).needsFunding).toBe(false)
    })

    test('an account open to enrollment is offered setup once the terms are known', () => {
        const open = { fundingMode: 'legacy', enrollmentAllowed: true } as CardFundingInputs['access']
        expect(cardFundingState(state({ access: open, funding: funding('ready') })).needsFunding).toBe(true)
        expect(cardFundingState(state({ access: open, funding: funding('ready', null, '') })).needsFunding).toBe(false)
    })

    test('a setup that still owes the card-balance move stays live once funding is ready', () => {
        const owes = { ...NO_HOLD, owesReturn: true }
        expect(cardFundingState(state({ funding: funding('ready'), hold: owes })).needsFunding).toBe(false)
        expect(
            cardFundingState(state({ funding: funding('ready'), hold: owes, overview: overview(500) })).needsFunding
        ).toBe(true)
        expect(
            cardFundingState(state({ funding: funding('ready'), hold: { ...owes, returnError: true } })).needsFunding
        ).toBe(true)
    })

    test('a grant that ended for good ends the prompt', () => {
        const ended = { ...NO_HOLD, endedForGood: true }
        expect(cardFundingState(state({ hold: ended })).needsFunding).toBe(false)
    })
})

describe('the prompt hold', () => {
    test('is per card and keeps a stable snapshot', () => {
        expect(getFundingPromptHold('card-a')).toBe(getFundingPromptHold('card-a'))
        setFundingPromptHold('card-a', { owesReturn: true })
        const held = getFundingPromptHold('card-a')
        expect(held).toEqual({ owesReturn: true, returnError: false, endedForGood: false })
        expect(getFundingPromptHold('card-a')).toBe(held)
        expect(getFundingPromptHold('card-b')).toEqual(NO_HOLD)
        expect(getFundingPromptHold(null)).toEqual(NO_HOLD)
    })
})

describe('buildJourneyState', () => {
    test('carries the funding decision into the card', () => {
        const state = buildJourneyState({
            cardLoaded: true,
            cardNeedsSetup: true,
            activeCardId: 'card-a',
            cardSetupPath: 'managed',
            cardNeedsFunding: true,
        } as JourneyInputs)
        expect(state.card).toEqual({
            loaded: true,
            needsSetup: true,
            activeCardId: 'card-a',
            setupPath: 'managed',
            needsFunding: true,
        })
    })
})
