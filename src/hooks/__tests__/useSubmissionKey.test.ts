import { renderHook } from '@testing-library/react'
import { useSubmissionKey } from '../useSubmissionKey'

describe('useSubmissionKey', () => {
    it('answers the same key while the body is unchanged', () => {
        const { result } = renderHook(() => useSubmissionKey())
        const first = result.current({ amount: '5', currency: 'USD' })
        expect(result.current({ amount: '5', currency: 'USD' })).toBe(first)
    })

    it('answers a new key when the body changes, and keeps it for that body', () => {
        const { result } = renderHook(() => useSubmissionKey())
        const first = result.current({ amount: '5' })
        const second = result.current({ amount: '6' })
        expect(second).not.toBe(first)
        expect(result.current({ amount: '6' })).toBe(second)
    })

    it('a change back to an earlier body is a new submission with a new key', () => {
        const { result } = renderHook(() => useSubmissionKey())
        const first = result.current({ amount: '5' })
        result.current({ amount: '6' })
        expect(result.current({ amount: '5' })).not.toBe(first)
    })

    it('keeps the key across re-renders', () => {
        const { result, rerender } = renderHook(() => useSubmissionKey())
        const first = result.current({ amount: '5' })
        rerender()
        expect(result.current({ amount: '5' })).toBe(first)
    })
})
