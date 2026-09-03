import { renderHook } from '@testing-library/react'
import { useBackHandler } from '@/hooks/useBackHandler'
import { dispatchBackPress, registerBackHandler, resetBackHandlersForTests } from '@/utils/back-handler'

describe('useBackHandler', () => {
    beforeEach(() => {
        resetBackHandlersForTests()
    })

    it('registers while enabled and consumes the press', () => {
        const handler = jest.fn(() => true)
        renderHook(() => useBackHandler(handler))

        expect(dispatchBackPress()).toBe(true)
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not register while disabled', () => {
        const handler = jest.fn(() => true)
        renderHook(() => useBackHandler(handler, false))

        expect(dispatchBackPress()).toBe(false)
        expect(handler).not.toHaveBeenCalled()
    })

    it('unregisters when enabled flips false and re-registers when it flips true', () => {
        const handler = jest.fn(() => true)
        const { rerender } = renderHook(({ enabled }) => useBackHandler(handler, enabled), {
            initialProps: { enabled: true },
        })

        rerender({ enabled: false })
        expect(dispatchBackPress()).toBe(false)

        rerender({ enabled: true })
        expect(dispatchBackPress()).toBe(true)
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('unregisters on unmount', () => {
        const handler = jest.fn(() => true)
        const { unmount } = renderHook(() => useBackHandler(handler))

        unmount()
        expect(dispatchBackPress()).toBe(false)
    })

    it('invokes the latest handler without moving its stack position', () => {
        const first = jest.fn(() => true)
        const second = jest.fn(() => true)
        const { rerender } = renderHook(({ handler }) => useBackHandler(handler), {
            initialProps: { handler: first },
        })
        // registered after the hook, so it sits above it in the stack
        const above = jest.fn(() => false)
        registerBackHandler(above)

        rerender({ handler: second })

        expect(dispatchBackPress()).toBe(true)
        expect(above).toHaveBeenCalledTimes(1)
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })
})
