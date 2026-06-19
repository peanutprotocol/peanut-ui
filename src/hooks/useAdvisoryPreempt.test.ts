import { act, renderHook } from '@testing-library/react'
import { useAdvisoryPreempt } from './useAdvisoryPreempt'
import type { GateAdvisory } from '@/utils/capability-gate'

const advisory: GateAdvisory = { effectiveDate: '2099-06-29', levelKey: 'eea_uplift' }

describe('useAdvisoryPreempt', () => {
    test('no advisory → intercept proceeds immediately, modal stays hidden', () => {
        const proceed = jest.fn()
        const onCompleteNow = jest.fn()
        const { result } = renderHook(() => useAdvisoryPreempt({ advisory: undefined, onCompleteNow }))

        act(() => result.current.intercept(proceed))

        expect(proceed).toHaveBeenCalledTimes(1)
        expect(result.current.modalProps.visible).toBe(false)
    })

    test('advisory present → intercept opens the modal and defers proceed', () => {
        const proceed = jest.fn()
        const onCompleteNow = jest.fn()
        const { result } = renderHook(() => useAdvisoryPreempt({ advisory, onCompleteNow }))

        act(() => result.current.intercept(proceed))

        expect(proceed).not.toHaveBeenCalled()
        expect(result.current.modalProps.visible).toBe(true)
        expect(result.current.modalProps.effectiveDate).toBe('2099-06-29')
    })

    test('skip runs the deferred proceed; once dismissed, later intercepts pass straight through', () => {
        const proceed = jest.fn()
        const onCompleteNow = jest.fn()
        const { result } = renderHook(() => useAdvisoryPreempt({ advisory, onCompleteNow }))

        act(() => result.current.intercept(proceed))
        act(() => result.current.modalProps.onSkip())

        expect(proceed).toHaveBeenCalledTimes(1)
        expect(result.current.modalProps.visible).toBe(false)

        // Dismissed for the session — a second proceed runs immediately, no re-prompt.
        const proceed2 = jest.fn()
        act(() => result.current.intercept(proceed2))
        expect(proceed2).toHaveBeenCalledTimes(1)
        expect(result.current.modalProps.visible).toBe(false)
    })

    test('completeNow launches the verification and does NOT run the deferred proceed', async () => {
        const proceed = jest.fn()
        const onCompleteNow = jest.fn()
        const { result } = renderHook(() => useAdvisoryPreempt({ advisory, onCompleteNow }))

        act(() => result.current.intercept(proceed))
        await act(async () => {
            await result.current.modalProps.onCompleteNow()
        })

        expect(onCompleteNow).toHaveBeenCalledTimes(1)
        expect(proceed).not.toHaveBeenCalled()
        expect(result.current.modalProps.visible).toBe(false)
    })
})
