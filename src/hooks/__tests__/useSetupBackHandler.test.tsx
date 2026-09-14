import { renderHook } from '@testing-library/react'
import { useSetupBackHandler } from '@/hooks/useSetupBackHandler'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'
import { minimizeNativeApp } from '@/utils/capacitor'
import { type ISetupStep } from '@/components/Setup/Setup.types'

jest.mock('@/utils/capacitor', () => ({
    minimizeNativeApp: jest.fn(() => Promise.resolve()),
}))

const stepWithBack = { screenId: 'signup', showBackButton: true } as unknown as ISetupStep
const stepWithoutBack = { screenId: 'sign-test-transaction', showBackButton: false } as unknown as ISetupStep
const stepUndefinedBack = { screenId: 'landing' } as unknown as ISetupStep

describe('useSetupBackHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        resetBackHandlersForTests()
    })

    it('steps back when the step shows a back button and stepping back is allowed', () => {
        const onBack = jest.fn()
        renderHook(() => useSetupBackHandler({ step: stepWithBack, canStepBack: true, onBack }))

        expect(dispatchBackPress()).toBe(true)
        expect(onBack).toHaveBeenCalledTimes(1)
        expect(minimizeNativeApp).not.toHaveBeenCalled()
    })

    it.each([
        ['showBackButton false', stepWithoutBack, true],
        ['showBackButton undefined', stepUndefinedBack, true],
        ['no step yet', undefined, true],
        ['canStepBack false', stepWithBack, false],
    ])('minimizes the app instead of navigating when %s', (_label, step, canStepBack) => {
        const onBack = jest.fn()
        renderHook(() => useSetupBackHandler({ step, canStepBack, onBack }))

        expect(dispatchBackPress()).toBe(true)
        expect(onBack).not.toHaveBeenCalled()
        expect(minimizeNativeApp).toHaveBeenCalledTimes(1)
    })

    it('always consumes the press so the native listener never reaches router.back', () => {
        renderHook(() => useSetupBackHandler({ step: undefined, canStepBack: false, onBack: jest.fn() }))
        expect(dispatchBackPress()).toBe(true)
    })

    it('reads the latest props on each press', () => {
        const onBack = jest.fn()
        const { rerender } = renderHook(({ step, canStepBack }) => useSetupBackHandler({ step, canStepBack, onBack }), {
            initialProps: { step: stepWithBack as ISetupStep | undefined, canStepBack: false },
        })

        dispatchBackPress()
        expect(onBack).not.toHaveBeenCalled()

        rerender({ step: stepWithBack, canStepBack: true })
        dispatchBackPress()
        expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('unregisters on unmount', () => {
        const { unmount } = renderHook(() =>
            useSetupBackHandler({ step: stepWithBack, canStepBack: true, onBack: jest.fn() })
        )
        unmount()
        expect(dispatchBackPress()).toBe(false)
    })
})
