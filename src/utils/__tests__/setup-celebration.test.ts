import { startSetupCelebration } from '../setup-celebration'
import type { CreateTypes } from 'canvas-confetti'

const fire = Object.assign(jest.fn(), { reset: jest.fn() })
beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
})
afterEach(() => jest.useRealTimers())
it('coordinates the dense top burst and side stars across the full height on one timeline', () => {
    startSetupCelebration(fire as unknown as CreateTypes, { native: false, reduced: false })
    const options = fire.mock.calls.map(([options]) => options)
    expect(options[0]).toMatchObject({ origin: { x: 0.5, y: 0.05 }, particleCount: 40 })
    expect(options.filter(({ origin }) => origin.x === 0)).toHaveLength(8)
    expect(options.filter(({ origin }) => origin.x === 1)).toHaveLength(8)
    expect(Math.max(...options.map(({ origin }) => origin.y))).toBeGreaterThan(0.9)
    const openingCalls = fire.mock.calls.length
    jest.advanceTimersByTime(240)
    expect(fire.mock.calls.length).toBe(openingCalls + 3)
    jest.advanceTimersByTime(2560)
    const endingCalls = fire.mock.calls.length
    jest.advanceTimersByTime(1400)
    expect(fire.mock.calls.length).toBe(endingCalls)
    expect(fire.reset).toHaveBeenCalledTimes(1)
})
it('clears both regions immediately on unmount, without later waves', () => {
    const stop = startSetupCelebration(fire as unknown as CreateTypes, { native: false, reduced: false })
    stop()
    const count = fire.mock.calls.length
    jest.advanceTimersByTime(5000)
    expect(fire).toHaveBeenCalledTimes(count)
    expect(fire.reset).toHaveBeenCalledTimes(1)
})
it('keeps native particle counts lower for the opening and subsequent waves', () => {
    startSetupCelebration(fire as unknown as CreateTypes, { native: true, reduced: false })
    expect(fire.mock.calls.reduce((n, [options]) => n + options.particleCount, 0)).toBe(40)
    jest.advanceTimersByTime(240)
    expect(fire.mock.calls.slice(-3).map(([options]) => options.particleCount)).toEqual([4, 1, 1])
})
it('uses one short burst with no ongoing curtain under reduced motion', () => {
    startSetupCelebration(fire as unknown as CreateTypes, { native: false, reduced: true })
    jest.advanceTimersByTime(4200)
    expect(fire).toHaveBeenCalledTimes(1)
    expect(fire.mock.calls[0][0]).toMatchObject({ particleCount: 10, ticks: 40 })
    expect(fire.reset).toHaveBeenCalledTimes(1)
})
