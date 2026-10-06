import { StrictMode } from 'react'
import { render, act } from '@testing-library/react'
import CelebrationCurtain from '../CelebrationCurtain'
const mockStop = jest.fn()
const mockStart: jest.Mock = jest.fn(() => mockStop)
const mockCreate: jest.Mock = jest.fn(() => jest.fn())
const mockIsNative = jest.fn(() => false)
jest.mock('canvas-confetti', () => ({
    __esModule: true,
    default: { create: (...args: unknown[]) => mockCreate(...args) },
}))
jest.mock('@/utils/setup-celebration', () => ({ startSetupCelebration: (...args: unknown[]) => mockStart(...args) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockIsNative() }))
beforeEach(() => {
    jest.clearAllMocks()
    mockIsNative.mockReturnValue(false)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    window.matchMedia = jest.fn(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    })) as never
})
it.each([false, true])('creates one scoped effect in Strict Mode and cleans it up (native=%s)', async (native) => {
    mockIsNative.mockReturnValue(native)
    const view = render(
        <StrictMode>
            <CelebrationCurtain />
        </StrictMode>
    )
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), { resize: true, useWorker: !native })
    expect(mockStart).toHaveBeenCalledWith(expect.any(Function), { native, reduced: false })
    view.unmount()
    expect(mockStop).toHaveBeenCalledTimes(1)
})
it('stops both regions when the app is hidden', async () => {
    const view = render(<CelebrationCurtain />)
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(mockStop).toHaveBeenCalledTimes(1)
    view.unmount()
})
