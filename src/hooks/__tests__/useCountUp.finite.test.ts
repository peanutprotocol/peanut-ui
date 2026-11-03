import { renderHook } from '@testing-library/react'
import { useCountUp } from '../useCountUp'
const mockAnimate = jest.fn((..._args: unknown[]) => ({ stop: jest.fn() }))
const mockWrite = jest.fn()
jest.mock('framer-motion', () => ({ animate: (...args: unknown[]) => mockAnimate(...args) }))
jest.mock('@/utils/native-platform', () => ({ useHydrationSnapshot: (client: () => unknown) => client() }))
jest.mock('@/utils/safe-storage', () => ({
    readStoredValue: () => null,
    writeStoredValue: (...args: unknown[]) => mockWrite(...args),
}))

beforeEach(() => jest.clearAllMocks())
test.each([NaN, Infinity, -Infinity])('invalid target %s never animates or persists', (target) => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target, { storageKey: 'test' }), {
        initialProps: { target },
    })
    expect(Object.is(result.current, target)).toBe(true)
    expect(mockAnimate).not.toHaveBeenCalled()
    expect(mockWrite).not.toHaveBeenCalled()
    rerender({ target: 4000 })
    expect(result.current).toBe(4000)
    expect(mockWrite).toHaveBeenCalledWith('peanut_points_test', '4000')
})
