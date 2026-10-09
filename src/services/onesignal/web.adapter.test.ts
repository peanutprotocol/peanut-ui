jest.mock('react-onesignal', () => ({
    __esModule: true,
    default: {
        Notifications: { requestPermission: jest.fn() },
        User: { PushSubscription: { optedIn: false, optIn: jest.fn(async () => {}) } },
    },
}))
import OneSignal from 'react-onesignal'
import { webOneSignalAdapter } from './web.adapter'

const original = Object.getOwnPropertyDescriptor(window, 'Notification')
afterAll(() => {
    if (original) Object.defineProperty(window, 'Notification', original)
    else Reflect.deleteProperty(window, 'Notification')
})
beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(OneSignal.User.PushSubscription, 'optedIn', { configurable: true, value: false })
})
it('registers already-granted browser permission without opening another prompt', async () => {
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted' } })
    await expect(webOneSignalAdapter.requestPermission()).resolves.toBe('granted')
    expect(OneSignal.Notifications.requestPermission).not.toHaveBeenCalled()
    expect(OneSignal.User.PushSubscription.optIn).toHaveBeenCalledTimes(1)
})
it('does not register denied permission', async () => {
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'denied' } })
    await expect(webOneSignalAdapter.requestPermission()).resolves.toBe('denied')
    expect(OneSignal.User.PushSubscription.optIn).not.toHaveBeenCalled()
})
it('does not repeat registration for an existing subscription', async () => {
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted' } })
    Object.defineProperty(OneSignal.User.PushSubscription, 'optedIn', { configurable: true, value: true })
    await webOneSignalAdapter.requestPermission()
    expect(OneSignal.User.PushSubscription.optIn).not.toHaveBeenCalled()
})
