const mockRemove = jest.fn()
let mockListener: ((state: { isActive: boolean }) => void) | undefined
jest.mock('@capacitor/app', () => ({
    App: {
        addListener: jest.fn(async (_event: string, listener: (state: { isActive: boolean }) => void) => {
            mockListener = listener
            return { remove: mockRemove }
        }),
    },
}))

import { watchNativeAppActive } from '../native-app-state'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
    mockRemove.mockReset()
    mockListener = undefined
})

it('forwards appStateChange until stopped, then removes the listener', async () => {
    const onChange = jest.fn()
    const stop = watchNativeAppActive(onChange)
    await flush()
    mockListener!({ isActive: false })
    expect(onChange).toHaveBeenCalledWith(false)
    stop()
    expect(mockRemove).toHaveBeenCalledTimes(1)
    mockListener!({ isActive: true })
    expect(onChange).toHaveBeenCalledTimes(1)
})

it('removes a listener whose registration lands after stop', async () => {
    const onChange = jest.fn()
    const stop = watchNativeAppActive(onChange)
    stop()
    await flush()
    expect(mockRemove).toHaveBeenCalledTimes(1)
    mockListener?.({ isActive: false })
    expect(onChange).not.toHaveBeenCalled()
})
