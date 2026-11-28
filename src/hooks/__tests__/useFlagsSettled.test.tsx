import { act, renderHook } from '@testing-library/react'

let deliverFlags: (() => void) | undefined
const unsubscribe = jest.fn()

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        onFeatureFlags: (callback: () => void) => {
            deliverFlags = callback
            return unsubscribe
        },
    },
}))

import { useFlagsSettled } from '../useFlagsSettled'

describe('useFlagsSettled', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        deliverFlags = undefined
        unsubscribe.mockClear()
    })
    afterEach(() => jest.useRealTimers())

    it('is false until PostHog answers', () => {
        expect(renderHook(() => useFlagsSettled()).result.current).toBe(false)
    })

    it('settles when the flags arrive', () => {
        const { result } = renderHook(() => useFlagsSettled())
        act(() => deliverFlags?.())
        expect(result.current).toBe(true)
    })

    it('settles anyway when PostHog never answers, so the page is not stuck', () => {
        const { result } = renderHook(() => useFlagsSettled())
        act(() => jest.advanceTimersByTime(4000))
        expect(result.current).toBe(true)
    })

    it('unsubscribes on unmount', () => {
        renderHook(() => useFlagsSettled()).unmount()
        expect(unsubscribe).toHaveBeenCalled()
    })
})
