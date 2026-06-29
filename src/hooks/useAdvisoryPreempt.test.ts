import { act, renderHook } from '@testing-library/react'
import { useAdvisoryPreempt } from './useAdvisoryPreempt'
import type { GateAdvisory } from '@/utils/capability-gate'

const advisory: GateAdvisory = { effectiveDate: '2099-06-29', actionKey: 'sumsub:eea_uplift' }

describe('useAdvisoryPreempt', () => {
    test('no advisory → intercept proceeds immediately, modal stays hidden', () => {
        const proceed = jest.fn()
        const onCompleteNow = jest.fn()
        const { result } = renderHook(() => useAdvisoryPreempt({ advisory: undefined, onCompleteNow }))

        act(() => result.current.intercept(proceed))

        expect(proceed).toHaveBeenCalledTimes(1)
        expect(result.current.modalProps.visible).toBe(false)
    })

    test('advisory present → intercept opens the modal and blocks proceed', () => {
        const proceed = jest.fn()
        const onCompleteNow = jest.fn()
        const { result } = renderHook(() => useAdvisoryPreempt({ advisory, onCompleteNow }))

        act(() => result.current.intercept(proceed))

        expect(proceed).not.toHaveBeenCalled()
        expect(result.current.modalProps.visible).toBe(true)
        expect(result.current.modalProps.effectiveDate).toBe('2099-06-29')
    })

    test('hard gate: while the advisory is pending, repeated intercepts never pass through', () => {
        const onCompleteNow = jest.fn()
        const { result } = renderHook(() => useAdvisoryPreempt({ advisory, onCompleteNow }))

        const proceed1 = jest.fn()
        act(() => result.current.intercept(proceed1))
        const proceed2 = jest.fn()
        act(() => result.current.intercept(proceed2))

        expect(proceed1).not.toHaveBeenCalled()
        expect(proceed2).not.toHaveBeenCalled()
        expect(result.current.modalProps.visible).toBe(true)
    })

    test('completeNow launches the verification, hides the modal, and does NOT run the deferred proceed', async () => {
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

    test('completeNow ignores rapid double-clicks (single submit)', async () => {
        let resolve: () => void = () => {}
        const onCompleteNow = jest.fn(() => new Promise<void>((r) => (resolve = r)))
        const { result } = renderHook(() => useAdvisoryPreempt({ advisory, onCompleteNow }))

        await act(async () => {
            result.current.modalProps.onCompleteNow()
            result.current.modalProps.onCompleteNow()
            resolve()
        })

        expect(onCompleteNow).toHaveBeenCalledTimes(1)
    })

    test('once the requirement clears (advisory undefined), intercept passes through again', () => {
        const onCompleteNow = jest.fn()
        const { result, rerender } = renderHook(
            ({ adv }: { adv: GateAdvisory | undefined }) => useAdvisoryPreempt({ advisory: adv, onCompleteNow }),
            { initialProps: { adv: advisory as GateAdvisory | undefined } }
        )

        const blocked = jest.fn()
        act(() => result.current.intercept(blocked))
        expect(blocked).not.toHaveBeenCalled()

        // Backend cleared the requirement → gate no longer carries an advisory.
        rerender({ adv: undefined })
        const proceed = jest.fn()
        act(() => result.current.intercept(proceed))
        expect(proceed).toHaveBeenCalledTimes(1)
    })
})
