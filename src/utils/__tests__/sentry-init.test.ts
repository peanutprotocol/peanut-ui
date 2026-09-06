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

const ENV_KEYS = ['NEXT_PUBLIC_CAPACITOR_BUILD', 'NEXT_PUBLIC_PERF_BARE'] as const
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

    it('inits exactly once on web, however many times it is called', async () => {
        const { initSentry, Sentry } = load({})
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
        const { initSentry, Sentry } = load({})
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

    it('mirrors everything else', () => {
        const { inner, wrapped } = wrap()
        wrapped.processEvent!(event({ message: 'TypeError: x is not a function' }))

        expect(inner).toHaveBeenCalledTimes(1)
    })
})
