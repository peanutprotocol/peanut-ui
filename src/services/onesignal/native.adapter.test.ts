import type { NotificationClickInfo } from './types'

// virtual: the plugin ships ESM-only exports jest's resolver can't load;
// the adapter only ever runs in native builds where webpack resolves it.
jest.mock(
    '@onesignal/capacitor-plugin',
    () => ({
        __esModule: true,
        default: {
            initialize: jest.fn().mockResolvedValue(undefined),
            login: jest.fn(),
            logout: jest.fn(),
            Notifications: {
                addEventListener: jest.fn(),
                hasPermission: jest.fn().mockResolvedValue(true),
                canRequestPermission: jest.fn().mockResolvedValue(true),
                requestPermission: jest.fn(),
            },
            User: {
                pushSubscription: {
                    addEventListener: jest.fn(),
                    getOptedInAsync: jest.fn().mockResolvedValue(true),
                },
            },
        },
    }),
    { virtual: true }
)

import OneSignal from '@onesignal/capacitor-plugin'
import { nativeOneSignalAdapter } from './native.adapter'

function getClickCallback(): (event: unknown) => void {
    const call = (OneSignal.Notifications.addEventListener as jest.Mock).mock.calls.find(([name]) => name === 'click')
    expect(call).toBeDefined()
    return call![1]
}

describe('nativeOneSignalAdapter cold-start click buffering', () => {
    beforeAll(async () => {
        process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID = 'test-app-id'
        await nativeOneSignalAdapter.init()
    })

    // The Capacitor bridge retains a cold-start click only until the first JS
    // listener attaches — which init() does. If the event arrives before
    // useNativePlugins has registered its routing callback, the adapter must
    // hold it and replay it, or the tap is silently dropped.
    it('replays a click that fired before any listener registered', () => {
        const fireClick = getClickCallback()
        fireClick({
            notification: {
                launchURL: 'https://peanut.me/receipt/intent-1?kind=ONRAMP',
                additionalData: { deepLink: '/receipt/intent-1?kind=ONRAMP' },
            },
        })

        const seen: NotificationClickInfo[] = []
        const off = nativeOneSignalAdapter.onNotificationClick((info) => seen.push(info))
        expect(seen).toEqual([
            {
                deepLink: 'https://peanut.me/receipt/intent-1?kind=ONRAMP',
                additionalData: { deepLink: '/receipt/intent-1?kind=ONRAMP' },
            },
        ])

        // one-shot: a second listener must not receive the same tap again
        const seenLater: NotificationClickInfo[] = []
        const offLater = nativeOneSignalAdapter.onNotificationClick((info) => seenLater.push(info))
        expect(seenLater).toEqual([])

        // once listeners exist, clicks are delivered live, not buffered
        fireClick({ result: { url: 'https://peanut.me/rewards' }, notification: { additionalData: {} } })
        expect(seen).toHaveLength(2)
        expect(seenLater).toHaveLength(1)

        off()
        offLater()
    })
})
