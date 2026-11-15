const mockSentry = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => mockSentry(...args) }))
const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))

import { ALL_ASKS, fact, guardAsk, guardAsks, resetAttentionFaultsForTests } from '../faults'
import { ASKS } from '../registry'
import type { AttentionAsk, JourneyState } from '../types'

const state = {} as JourneyState
const boom = () => {
    throw new Error('boom')
}

const brokenAsk: AttentionAsk = {
    id: 'invite',
    tier: 3,
    rank: 4,
    surfaces: ['interrupt', 'zone', 'inline'],
    eligible: boom,
    renderable: boom,
    deviceGate: boom,
    version: boom,
    legacyProps: boom,
    policy: { slotWhen: boom, surfaceWhen: { interrupt: boom, zone: boom }, snoozeDays: 7 },
    analyticsKey: 'invite',
}

beforeEach(() => {
    resetAttentionFaultsForTests()
    mockSentry.mockClear()
    mockCapture.mockClear()
})

describe('guardAsk', () => {
    test('every rule that throws falls back to the answer that hides the ask', () => {
        const ask = guardAsk(brokenAsk, false)
        expect(ask.eligible(state)).toBe('ineligible')
        expect(ask.renderable?.(state)).toBe(false)
        expect(ask.deviceGate?.(state)).toBe('ineligible')
        expect(ask.version?.(state)).toBeUndefined()
        expect(ask.legacyProps?.(state, 'shown')).toEqual({})
        expect(ask.policy.slotWhen?.(state, undefined)).toBe(false)
        expect(ask.policy.surfaceWhen?.interrupt?.(state)).toBe(false)
        expect(ask.policy.surfaceWhen?.zone?.(state)).toBe(false)
        expect(ask.policy.snoozeDays).toBe(7)
    })

    test('a rule that keeps throwing files one Sentry report and one attention_crashed per load', () => {
        const ask = guardAsk(brokenAsk, false)
        for (let i = 0; i < 5; i++) ask.eligible(state)
        expect(mockSentry).toHaveBeenCalledTimes(1)
        expect(mockSentry).toHaveBeenCalledWith(expect.any(Error), {
            tags: { feature: 'attention', ask: 'invite', rule: 'eligible' },
        })
        expect(mockCapture).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith('attention_crashed', { ask: 'invite', rule: 'eligible', tier: 3 })
    })

    test('a healthy ask answers as before and adds no optional rules', () => {
        const [maintenance] = ASKS
        const guarded = guardAsk(maintenance, false)
        expect(guarded.eligible({ ...state, maintenance: 'full' })).toBe('show')
        expect(Object.keys(guarded).sort()).toEqual(Object.keys(maintenance).sort())
        expect(mockSentry).not.toHaveBeenCalled()
    })

    test('a disabled ask never runs its rule', () => {
        const eligible = jest.fn(() => 'show' as const)
        expect(guardAsk({ ...brokenAsk, eligible }, true).eligible(state)).toBe('ineligible')
        expect(eligible).not.toHaveBeenCalled()
    })
})

describe('guardAsks', () => {
    const show = (asks: readonly AttentionAsk[]) =>
        asks.filter((ask) => ask.eligible({ ...state, maintenance: 'full' }) === 'show').map((ask) => ask.id)

    test('the kill switch list turns off the asks it names', () => {
        expect(show(guardAsks(ASKS, []))).toContain('maintenance')
        expect(show(guardAsks(ASKS, ['maintenance']))).not.toContain('maintenance')
    })

    test(`"${ALL_ASKS}" turns off every ask`, () => {
        expect(show(guardAsks(ASKS, [ALL_ASKS]))).toEqual([])
    })
})

describe('fact', () => {
    test('a throw reads as the fallback and files one report per fact', () => {
        expect(fact('history', boom, 'fallback')).toBe('fallback')
        expect(fact('history', boom, 'fallback')).toBe('fallback')
        expect(fact('qr', () => 'value', 'fallback')).toBe('value')
        expect(mockSentry).toHaveBeenCalledTimes(1)
        expect(mockSentry).toHaveBeenCalledWith(expect.any(Error), { tags: { feature: 'attention', fact: 'history' } })
    })
})
