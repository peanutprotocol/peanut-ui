import type { ErrorEvent as SentryErrorEvent } from '@sentry/nextjs'

jest.mock('@sentry/nextjs', () => ({
    init: jest.fn(),
    getClient: jest.fn(),
    captureException: jest.fn(),
    captureConsoleIntegration: jest.fn(() => ({ name: 'CaptureConsole' })),
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        sentryIntegration: jest.fn(() => ({ name: 'posthog-error-tracking', processEvent: (e: unknown) => e })),
    },
}))

type SentryMock = { init: jest.Mock; getClient: jest.Mock }

const ENV_KEYS = ['NEXT_PUBLIC_CAPACITOR_BUILD', 'NEXT_PUBLIC_PERF_BARE', 'NEXT_PUBLIC_VERCEL_ENV'] as const
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function load(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
    jest.resetModules()
    for (const key of ENV_KEYS) {
        if (env[key] === undefined) delete process.env[key]
        else process.env[key] = env[key]
    }
    const mod = require('../sentry-init') as typeof import('../sentry-init')
    const Sentry = require('@sentry/nextjs') as SentryMock
    return { ...mod, Sentry }
}

beforeEach(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
})

afterEach(() => {
    for (const key of ENV_KEYS) {
        if (savedEnv[key] === undefined) delete process.env[key]
        else process.env[key] = savedEnv[key]
    }
})

describe('initSentry', () => {
    it('never inits on the Capacitor build — instrumentation-client owns that client', async () => {
        const { initSentry, Sentry } = load({ NEXT_PUBLIC_CAPACITOR_BUILD: 'true' })

        initSentry()
        await flush()

        expect(Sentry.init).not.toHaveBeenCalled()
    })

    // Preview stays on: the OTA liveness proof reads preview events out of Sentry.
    it('still inits on a PR preview', async () => {
        const { initSentry, Sentry } = load({ NEXT_PUBLIC_VERCEL_ENV: 'preview' })
        Sentry.getClient.mockReturnValue(undefined)

        initSentry()
        await flush()

        expect(Sentry.init).toHaveBeenCalledTimes(1)
    })

    // A `next build` on a laptop has NODE_ENV=production and no VERCEL_ENV, so it
    // used to report as production. It infers 'development' now and reports nothing.
    it('never inits on a local build', async () => {
        const { initSentry, Sentry } = load({})
        Sentry.getClient.mockReturnValue(undefined)

        initSentry()
        await flush()

        expect(Sentry.init).not.toHaveBeenCalled()
    })

    it('inits exactly once on web, however many times it is called', async () => {
        const { initSentry, Sentry } = load({ NEXT_PUBLIC_VERCEL_ENV: 'production' })
        Sentry.getClient.mockReturnValue(undefined)

        initSentry()
        initSentry()
        await flush()
        initSentry()
        await flush()

        expect(Sentry.init).toHaveBeenCalledTimes(1)
        expect(Sentry.init.mock.calls[0][0]).toMatchObject({ attachStacktrace: true })
    })

    it('leaves an existing client alone', async () => {
        const { initSentry, Sentry } = load({ NEXT_PUBLIC_VERCEL_ENV: 'production' })
        Sentry.getClient.mockReturnValue({})

        initSentry()
        await flush()

        expect(Sentry.init).not.toHaveBeenCalled()
    })
})

describe('withoutNoise', () => {
    const event = (partial: Partial<SentryErrorEvent>) => partial as SentryErrorEvent
    const wrap = () => {
        const { withoutNoise } = load({})
        const inner = jest.fn((e: SentryErrorEvent) => e)
        return { inner, wrapped: withoutNoise({ name: 'mirror', processEvent: inner }) }
    }

    it('skips the mirror for transient Capgo updater noise', () => {
        const { inner, wrapped } = wrap()
        const e = event({ message: '[CapgoUpdater] 🔴 Failed to send stats batch' })

        expect(wrapped.processEvent!(e)).toBe(e)
        expect(inner).not.toHaveBeenCalled()
    })

    it('still mirrors an actionable Capgo failure', () => {
        const { inner, wrapped } = wrap()
        wrapped.processEvent!(event({ message: '[CapgoUpdater] 🔴 Checksum mismatch' }))

        expect(inner).toHaveBeenCalledTimes(1)
    })

    it('skips the mirror for injected third-party script frames', () => {
        const { inner, wrapped } = wrap()
        wrapped.processEvent!(
            event({
                exception: { values: [{ stacktrace: { frames: [{ filename: 'app:///executors/200.js' }] } }] },
            })
        )

        expect(inner).not.toHaveBeenCalled()
    })

    it('skips the mirror for a Brave iOS host-evaluated script error', () => {
        const { inner, wrapped } = wrap()
        wrapped.processEvent!(
            event({
                exception: {
                    values: [
                        {
                            type: 'TypeError',
                            value: "undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
                            stacktrace: { frames: [{ filename: 'https://peanut.me/home' }] },
                        },
                    ],
                },
            })
        )

        expect(inner).not.toHaveBeenCalled()
    })

    it('mirrors everything else', () => {
        const { inner, wrapped } = wrap()
        wrapped.processEvent!(event({ message: 'TypeError: x is not a function' }))

        expect(inner).toHaveBeenCalledTimes(1)
    })
})

describe('initSentry — failed SDK load', () => {
    afterEach(() => {
        jest.dontMock('../sentry-lazy')
    })

    it('releases the start latch, so the next trigger loads the SDK again', async () => {
        jest.resetModules()
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
        delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        delete process.env.NEXT_PUBLIC_PERF_BARE
        const sdk = {
            init: jest.fn(),
            getClient: jest.fn(),
            captureException: jest.fn(),
            captureConsoleIntegration: jest.fn(() => ({ name: 'CaptureConsole' })),
        }
        const loadSentry = jest.fn().mockRejectedValueOnce(new Error('ChunkLoadError')).mockResolvedValue(sdk)
        jest.doMock('../sentry-lazy', () => ({ loadSentry }))
        const { initSentry } = require('../sentry-init') as typeof import('../sentry-init')

        initSentry()
        await flush()
        expect(sdk.init).not.toHaveBeenCalled()

        initSentry()
        await flush()
        expect(loadSentry).toHaveBeenCalledTimes(2)
        expect(sdk.init).toHaveBeenCalledTimes(1)
    })
})
