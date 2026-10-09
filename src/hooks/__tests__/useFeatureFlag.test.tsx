import { renderHook, act } from '@testing-library/react'

// posthog-js is mocked so the test controls when flags "load"
let mockFlagsCallback: (() => void) | undefined
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        isFeatureEnabled: jest.fn(),
        onFeatureFlags: (cb: () => void) => {
            mockFlagsCallback = cb
            return () => {
                mockFlagsCallback = undefined
            }
        },
    },
}))

import { useFeatureFlags } from '../useFeatureFlag'

describe('useFeatureFlags', () => {
    it('returns a NEW checker identity when PostHog flags load (memo-busting)', () => {
        const { result } = renderHook(() => useFeatureFlags())
        const before = result.current
        act(() => mockFlagsCallback?.())
        expect(result.current).not.toBe(before) // regression: frozen-at-mount gate
    })
})
