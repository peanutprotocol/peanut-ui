/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import type { CapabilityRoute, NextAction } from '@/types/capabilities'

let mockNextActions: NextAction[] = []
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ nextActions: mockNextActions }) }))

import { usePixFlowSetupState } from '../usePixFlowSetupState'

const TERMS = { key: 'accept-tos:avenia', url: 'https://app.avenia.io/Avenia-TC.pdf' }
const TERMS_ACTION: NextAction = {
    key: 'accept-tos:avenia',
    kind: 'accept-tos',
    purpose: 'unlock-avenia',
    tosUrl: TERMS.url,
}
const route = (overrides: Partial<CapabilityRoute> = {}): CapabilityRoute => ({
    operation: 'withdraw',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [],
    ...overrides,
})
const renderGate = (initial: CapabilityRoute, opened = false) =>
    renderHook(({ r, o }: { r: CapabilityRoute; o: boolean }) => usePixFlowSetupState(r, o), {
        initialProps: { r: initial, o: opened },
    })

// TASK-25073: Avenia's terms gate each new attempt of a Pix flow, never a payment already opened
describe('usePixFlowSetupState', () => {
    beforeEach(() => {
        mockNextActions = []
    })

    it('an existing Avenia account meets the terms first, then the flow it opened', () => {
        const { result, rerender } = renderGate(route({ terms: TERMS }))
        expect(result.current).toBe('accept-terms')

        // accepted: the read after it names no terms
        rerender({ o: false, r: route() })
        expect(result.current).toBe('ready')
    })

    it('a new user accepts the terms, then the account opens, then the flow starts', () => {
        const { result, rerender } = renderGate(route({ state: 'action_required', action: 'activate', terms: TERMS }))
        expect(result.current).toBe('accept-terms')
        rerender({ o: false, r: route({ state: 'action_required', action: 'activate' }) })
        expect(result.current).toBe('activate')
        rerender({ o: false, r: route() })
        expect(result.current).toBe('ready')
    })

    it('a flow that started keeps its screen when a later read brings the terms, in either shape', () => {
        const { result, rerender } = renderGate(route())
        expect(result.current).toBe('ready')

        rerender({ o: false, r: route({ terms: TERMS }) })
        expect(result.current).toBe('ready')

        mockNextActions = [TERMS_ACTION]
        rerender({ o: false, r: route({ state: 'action_required', action: 'accept-tos:avenia' }) })
        expect(result.current).toBe('ready')
    })

    it('terms never replace an opened payment, and the next attempt in the same screen asks for them', () => {
        // a deposit code on screen, read with the route ready
        const { result, rerender } = renderGate(route(), true)
        rerender({ o: true, r: route({ terms: TERMS }) })
        expect(result.current).toBe('ready')

        // Start new deposit: the payment closes, and the new one asks first
        rerender({ o: false, r: route({ terms: TERMS }) })
        expect(result.current).toBe('accept-terms')
        rerender({ o: false, r: route() })
        expect(result.current).toBe('ready')
    })

    it('a flow that started still meets every other step, as before', () => {
        const { result, rerender } = renderGate(route())
        rerender({ o: false, r: route({ state: 'pending', terms: TERMS }) })
        expect(result.current).toBe('pending')
        rerender({ o: false, r: route({ state: 'action_required', action: 'verify', terms: TERMS }) })
        expect(result.current).toBe('verify')
    })

    it('reads the older shape, an accept-tos next action, as the same step at entry', () => {
        mockNextActions = [TERMS_ACTION]
        const { result } = renderGate(route({ state: 'action_required', action: 'accept-tos:avenia' }))
        expect(result.current).toBe('accept-terms')
    })
})
