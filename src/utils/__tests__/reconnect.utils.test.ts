import { onReconnect } from '../reconnect.utils'

describe('onReconnect', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })
    afterEach(() => {
        jest.useRealTimers()
    })

    it('fires once on the online event and unsubscribes itself', () => {
        const onReady = jest.fn()
        onReconnect(onReady, 60_000)

        window.dispatchEvent(new Event('online'))
        window.dispatchEvent(new Event('online'))
        jest.advanceTimersByTime(60_000)

        expect(onReady).toHaveBeenCalledTimes(1)
    })

    it('fires when the document becomes visible again', () => {
        const onReady = jest.fn()
        onReconnect(onReady, 60_000)

        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
        expect(onReady).not.toHaveBeenCalled()

        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
        expect(onReady).toHaveBeenCalledTimes(1)
    })

    it('falls back to the timer when no signal arrives', () => {
        const onReady = jest.fn()
        onReconnect(onReady, 5_000)

        jest.advanceTimersByTime(4_999)
        expect(onReady).not.toHaveBeenCalled()
        jest.advanceTimersByTime(1)
        expect(onReady).toHaveBeenCalledTimes(1)
    })

    it('never fires after unsubscribe', () => {
        const onReady = jest.fn()
        const stop = onReconnect(onReady, 5_000)

        stop()
        window.dispatchEvent(new Event('online'))
        jest.advanceTimersByTime(5_000)

        expect(onReady).not.toHaveBeenCalled()
    })
})
