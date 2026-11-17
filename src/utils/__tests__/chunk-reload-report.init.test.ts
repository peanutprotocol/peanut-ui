jest.mock('../../../sentry.utils', () => ({
    beforeSendHandler: (event: unknown) => event,
    redactSentryTelemetry: (event: unknown) => event,
}))
jest.mock('@/utils/sentry-posthog-mirror', () => ({
    posthogErrorMirror: () => ({}),
    withoutNoise: (event: unknown) => event,
}))
jest.mock('@/utils/sentry-env', () => ({
    inferSentryEnvironment: () => 'production',
    isSentryReportingEnvironment: () => true,
}))
jest.mock('@/utils/private-routes', () => ({ isPrivateDataPath: () => false }))
jest.mock('@/utils/sentry-lazy', () => ({ loadSentry: jest.fn() }))

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: Error) => void
    const promise = new Promise<T>((done, fail) => {
        resolve = done
        reject = fail
    })
    return { promise, resolve, reject }
}

describe('initSentry readiness for chunk reload reporting', () => {
    const originalEnvironment = { ...process.env }
    let addedListeners: jest.SpyInstance

    beforeEach(() => {
        jest.resetModules()
        addedListeners = jest.spyOn(window, 'addEventListener')
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
        process.env.NEXT_PUBLIC_PERF_BARE = 'false'
        process.env.PERF_BARE = 'false'
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
        process.env.VERCEL_ENV = 'production'
    })

    afterEach(() => {
        for (const [type, listener, options] of addedListeners.mock.calls) {
            window.removeEventListener(type, listener, options)
        }
        addedListeners.mockRestore()
        process.env = { ...originalEnvironment }
    })

    function setup() {
        const sdk = {
            init: jest.fn(),
            getClient: jest.fn<unknown, []>(() => undefined),
            captureConsoleIntegration: jest.fn(() => ({})),
            captureException: jest.fn(),
        }
        const loading = deferred<typeof sdk>()
        const { loadSentry } = require('@/utils/sentry-lazy') as { loadSentry: jest.Mock }
        loadSentry.mockReturnValue(loading.promise)
        const { initSentry } = require('../sentry-init') as { initSentry: () => Promise<void> | undefined }
        return { sdk, loading, loadSentry, initSentry }
    }

    it('keeps cold and concurrent callers pending until the SDK is ready, then initializes once', async () => {
        const { sdk, loading, loadSentry, initSentry } = setup()
        const first = initSentry()
        const second = initSentry()
        expect(first).toBeDefined()
        expect(second).toBe(first)
        const report = jest.fn()
        const reported = Promise.resolve(second).then(report)
        await Promise.resolve()
        expect(report).not.toHaveBeenCalled()
        expect(sdk.init).not.toHaveBeenCalled()
        loading.resolve(sdk)
        await reported
        expect(sdk.init).toHaveBeenCalledTimes(1)
        expect(loadSentry).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledTimes(1)
        await initSentry()
        expect(sdk.init).toHaveBeenCalledTimes(1)
    })

    it('completes readiness for an existing SDK client without initializing again', async () => {
        const { sdk, loading, initSentry } = setup()
        sdk.getClient.mockReturnValue({})
        const ready = initSentry()
        expect(ready).toBeDefined()
        const report = jest.fn()
        const reported = Promise.resolve(ready).then(report)
        await Promise.resolve()
        expect(report).not.toHaveBeenCalled()
        loading.resolve(sdk)
        await reported
        expect(sdk.init).not.toHaveBeenCalled()
        expect(report).toHaveBeenCalledTimes(1)
    })

    it('settles failed loading so reporting can continue, then permits a fresh attempt', async () => {
        const { sdk, loading, loadSentry, initSentry } = setup()
        const ready = initSentry()
        expect(ready).toBeDefined()
        loading.reject(new Error('SDK unavailable'))
        await expect(ready).resolves.toBeUndefined()
        const retry = deferred<typeof sdk>()
        loadSentry.mockReturnValue(retry.promise)
        const retried = initSentry()
        expect(retried).toBeDefined()
        retry.resolve(sdk)
        await retried
        expect(loadSentry).toHaveBeenCalledTimes(2)
        expect(sdk.init).toHaveBeenCalledTimes(1)
    })
})
