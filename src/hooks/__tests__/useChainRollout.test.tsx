import { renderHook, act } from '@testing-library/react'

// posthog-js is mocked so tests control flag values and load events
let mockFlagsCallback: (() => void) | undefined
const mockIsFeatureEnabled = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        isFeatureEnabled: (key: string) => mockIsFeatureEnabled(key),
        onFeatureFlags: (cb: () => void) => {
            mockFlagsCallback = cb
            return () => {
                mockFlagsCallback = undefined
            }
        },
    },
}))
// Force prod-domain semantics so the nonProdBypass doesn't short-circuit
jest.mock('@/constants/general.consts', () => ({
    ...jest.requireActual('@/constants/general.consts'),
    BASE_URL: 'https://peanut.me',
}))

import { useChainRollout } from '../useChainRollout'
import { useFeatureFlags } from '../useFeatureFlag'

describe('useFeatureFlags', () => {
    it('returns a NEW checker identity when PostHog flags load (memo-busting)', () => {
        const { result } = renderHook(() => useFeatureFlags())
        const before = result.current
        act(() => mockFlagsCallback?.())
        expect(result.current).not.toBe(before) // regression: frozen-at-mount gate
    })
})

describe('useChainRollout', () => {
    beforeEach(() => mockIsFeatureEnabled.mockReset())

    it('always allows unflagged (legacy) chains', () => {
        const { result } = renderHook(() => useChainRollout())
        expect(result.current('42161')).toBe(true)
        expect(mockIsFeatureEnabled).not.toHaveBeenCalled()
    })

    it('fails CLOSED on prod when PostHog has no answer', () => {
        mockIsFeatureEnabled.mockReturnValue(undefined)
        const { result } = renderHook(() => useChainRollout())
        expect(result.current('solana')).toBe(false)
    })

    it('reflects flag values once loaded, keyed per chain', () => {
        mockIsFeatureEnabled.mockImplementation((key: string) => key === 'chain-rollout-tempo')
        const { result } = renderHook(() => useChainRollout())
        act(() => mockFlagsCallback?.())
        expect(result.current('4217')).toBe(true) // tempo by chainId
        expect(result.current('TEMPO')).toBe(true) // tempo by deposit ChainName — same flag
        expect(result.current('solana')).toBe(false)
    })
})
