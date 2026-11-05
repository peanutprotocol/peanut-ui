import { act } from '@testing-library/react'
import { mountCardContinuation } from '../addon-continuation/addon-ui-real-render-adapter'
import type { MountCardContinuity } from './ui-adapter-contract'

// Install the clock before mounting so React Query owns the real polling timer.
export const mountCardContinuity: MountCardContinuity = async (options) => {
    jest.useFakeTimers()
    try {
        const card = await mountCardContinuation(options)
        const visibility = jest.spyOn(document, 'visibilityState', 'get')
        return {
            ...card,
            advanceTime: async (ms) => {
                await act(async () => {
                    await jest.advanceTimersByTimeAsync(ms)
                })
            },
            focusWindow: async () => {
                await act(async () => {
                    visibility.mockReturnValue('hidden')
                    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
                    window.dispatchEvent(new Event('blur'))
                    // A foreground return after the overview becomes stale. Advancing
                    // the clock alone does not fire the background polling timer.
                    jest.setSystemTime(Date.now() + 30_001)
                    visibility.mockReturnValue('visible')
                    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
                    window.dispatchEvent(new Event('focus'))
                    await jest.advanceTimersByTimeAsync(0)
                })
            },
            dispose: async () => {
                await card.dispose()
                visibility.mockRestore()
                jest.useRealTimers()
            },
        }
    } catch (error) {
        jest.useRealTimers()
        throw error
    }
}
