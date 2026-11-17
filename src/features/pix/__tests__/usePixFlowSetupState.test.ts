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
const renderGate = (initial: CapabilityRoute) =>
    renderHook(({ r }: { r: CapabilityRoute }) => usePixFlowSetupState(r), { initialProps: { r: initial } })

// TASK-25073: Avenia's terms gate a Pix flow at its entry, never in the middle
describe('usePixFlowSetupState', () => {
    beforeEach(() => {
        mockNextActions = []
    })

    it('an existing Avenia account meets the terms first, then the flow it opened', () => {
        const { result, rerender } = renderGate(route({ terms: TERMS }))
        expect(result.current).toBe('accept-terms')

        // accepted: the read after it names no terms
        rerender({ r: route() })
        expect(result.current).toBe('ready')
    })

    it('a new user accepts the terms, then the account opens, then the flow starts', () => {
        const { result, rerender } = renderGate(route({ state: 'action_required', action: 'activate', terms: TERMS }))
        expect(result.current).toBe('accept-terms')
        rerender({ r: route({ state: 'action_required', action: 'activate' }) })
        expect(result.current).toBe('activate')
        rerender({ r: route() })
        expect(result.current).toBe('ready')
    })

    it('a flow that started keeps its screen when a later read brings the terms, in either shape', () => {
        const { result, rerender } = renderGate(route())
        expect(result.current).toBe('ready')

        rerender({ r: route({ terms: TERMS }) })
        expect(result.current).toBe('ready')

        mockNextActions = [TERMS_ACTION]
        rerender({ r: route({ state: 'action_required', action: 'accept-tos:avenia' }) })
        expect(result.current).toBe('ready')
    })

    it('a flow that started still meets every other step, as before', () => {
        const { result, rerender } = renderGate(route())
        rerender({ r: route({ state: 'pending', terms: TERMS }) })
        expect(result.current).toBe('pending')
        rerender({ r: route({ state: 'action_required', action: 'verify', terms: TERMS }) })
        expect(result.current).toBe('verify')
    })

    it('reads the older shape, an accept-tos next action, as the same step at entry', () => {
        mockNextActions = [TERMS_ACTION]
        const { result } = renderGate(route({ state: 'action_required', action: 'accept-tos:avenia' }))
        expect(result.current).toBe('accept-terms')
    })
})
