import { act, renderHook } from '@testing-library/react'
import { animate } from 'framer-motion'
import { useCountUp } from '../useCountUp'
import { DEFAULT_ACCESSIBILITY, updateAccessibilityPreferences } from '@/utils/accessibility-preferences'

jest.mock('framer-motion', () => ({ animate: jest.fn(() => ({ stop: jest.fn() })) }))

beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
    act(() => updateAccessibilityPreferences(DEFAULT_ACCESSIBILITY))
})

it('remembers points seen with reduced motion when motion is enabled on a later visit', () => {
    localStorage.setItem('peanut_points_test', '100')
    act(() => updateAccessibilityPreferences({ motion: 'on' }))
    const first = renderHook(() => useCountUp(200, { storageKey: 'test' }))
    expect(first.result.current).toBe(200)
    expect(localStorage.getItem('peanut_points_test')).toBe('200')
    expect(animate).not.toHaveBeenCalled()
    first.unmount()

    act(() => updateAccessibilityPreferences({ motion: 'off' }))
    const second = renderHook(() => useCountUp(200, { storageKey: 'test' }))
    expect(second.result.current).toBe(200)
    expect(animate).not.toHaveBeenCalled()
})

it('keeps a snapped run complete when motion is enabled and the points target changes', () => {
    localStorage.setItem('peanut_points_test', '100')
    act(() => updateAccessibilityPreferences({ motion: 'on' }))
    const view = renderHook(({ target }) => useCountUp(target, { storageKey: 'test' }), {
        initialProps: { target: 200 },
    })
    act(() => {
        updateAccessibilityPreferences({ motion: 'off' })
        view.rerender({ target: 300 })
    })
    expect(view.result.current).toBe(300)
    expect(localStorage.getItem('peanut_points_test')).toBe('300')
    expect(animate).not.toHaveBeenCalled()
})
