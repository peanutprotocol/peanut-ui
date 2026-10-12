// virtual: the plugin ships ESM-only exports jest's resolver can't load
jest.mock(
    '@onesignal/capacitor-plugin',
    () => ({
        __esModule: true,
        LogLevel: { Verbose: 6 },
        default: {
            initialize: jest.fn().mockResolvedValue(undefined),
            Debug: { setLogLevel: jest.fn() },
            Notifications: { addEventListener: jest.fn() },
            User: { pushSubscription: { addEventListener: jest.fn() } },
        },
    }),
    { virtual: true }
)
jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

type PluginMock = {
    initialize: jest.Mock
    Notifications: { addEventListener: jest.Mock }
}

function fresh() {
    jest.resetModules()
    const OneSignal = (require('@onesignal/capacitor-plugin') as { default: PluginMock }).default
    const { nativeOneSignalAdapter } = require('./native.adapter') as typeof import('./native.adapter')
    return { OneSignal, adapter: nativeOneSignalAdapter }
}

const clickListenerCount = (OneSignal: PluginMock) =>
    OneSignal.Notifications.addEventListener.mock.calls.filter(([name]) => name === 'click').length

describe('nativeOneSignalAdapter init recovery', () => {
    const savedAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    beforeEach(() => {
        jest.useFakeTimers()
        process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID = 'test-app-id'
    })
    afterEach(() => {
        jest.useRealTimers()
        if (savedAppId === undefined) delete process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
        else process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID = savedAppId
    })

    it('runs initialize again after a transient failure and attaches the SDK listeners once', async () => {
        const { OneSignal, adapter } = fresh()
        OneSignal.initialize.mockRejectedValueOnce(new Error('bridge unavailable'))

        await expect(adapter.init()).rejects.toThrow('bridge unavailable')
        await expect(adapter.init()).resolves.toBeUndefined()
        await adapter.init()

        expect(OneSignal.initialize).toHaveBeenCalledTimes(2)
        expect(clickListenerCount(OneSignal)).toBe(1)
    })

    it('keeps a permanent plugin failure instead of calling initialize again', async () => {
        const { OneSignal, adapter } = fresh()
        OneSignal.initialize.mockRejectedValueOnce(
            Object.assign(new Error('not implemented'), { code: 'UNIMPLEMENTED' })
        )

        const first = adapter.init()
        await expect(first).rejects.toThrow('not implemented')
        expect(adapter.init()).toBe(first)
        expect(OneSignal.initialize).toHaveBeenCalledTimes(1)
    })

    it('keeps a missing app id failure without touching the SDK', async () => {
        delete process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
        const { OneSignal, adapter } = fresh()

        const first = adapter.init()
        await expect(first).rejects.toMatchObject({ name: 'OneSignalConfigError' })
        expect(adapter.init()).toBe(first)
        expect(OneSignal.initialize).not.toHaveBeenCalled()
    })
})

export {}
