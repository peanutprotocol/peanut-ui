/**
 * A failed SDK chunk must not disable reporting for the document, and must not
 * escape as an unhandled rejection: the inline chunk-recovery script reloads the
 * page on any unhandled ChunkLoadError.
 */
let mockFailuresLeft = 0
let mockLoads = 0
const mockSdk = { captureException: jest.fn() }
const mockChunkError = () =>
    Object.assign(new Error('Loading chunk 57083 failed.\n(error: https://peanut.me/_next/static/chunks/57083.js)'), {
        name: 'ChunkLoadError',
    })

jest.mock('@sentry/nextjs', () => {
    mockLoads += 1
    if (mockFailuresLeft > 0) {
        mockFailuresLeft -= 1
        throw mockChunkError()
    }
    return mockSdk
})

jest.mock('posthog-js', () => ({ __esModule: true, default: { captureException: jest.fn() } }))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function fresh(failures: number) {
    jest.resetModules()
    mockFailuresLeft = failures
    mockLoads = 0
    mockSdk.captureException.mockClear()
    const lazy = require('../sentry-lazy') as typeof import('../sentry-lazy')
    const posthog = (require('posthog-js') as { default: { captureException: jest.Mock } }).default
    return { lazy, posthog }
}

describe('sentry-lazy — failed SDK loads', () => {
    let unhandled: jest.Mock
    beforeEach(() => {
        unhandled = jest.fn()
        process.on('unhandledRejection', unhandled)
    })
    afterEach(() => {
        process.off('unhandledRejection', unhandled)
    })

    it('retries a failed chunk once within the same load', async () => {
        const { lazy } = fresh(1)
        lazy.captureException(new Error('early'))
        await flush()
        expect(mockLoads).toBe(2)
        expect(mockSdk.captureException).toHaveBeenCalledTimes(1)
    })

    it('does not leave a rejection unhandled, and a later capture loads the SDK again', async () => {
        const { lazy } = fresh(2)
        lazy.captureException(new Error('lost'))
        await flush()
        expect(mockSdk.captureException).not.toHaveBeenCalled()

        lazy.captureException(new Error('delivered'))
        await flush()
        expect(mockSdk.captureException).toHaveBeenCalledWith(new Error('delivered'), undefined)
        expect(unhandled).not.toHaveBeenCalled()
    })

    it('stops after three failed loads and reports the last failure to PostHog once', async () => {
        const { lazy, posthog } = fresh(Infinity)
        for (let i = 0; i < 5; i++) {
            lazy.captureException(new Error(`capture ${i}`))
            await flush()
        }
        expect(mockLoads).toBe(6)
        expect(posthog.captureException).toHaveBeenCalledTimes(1)
        expect(posthog.captureException).toHaveBeenCalledWith(expect.objectContaining({ name: 'ChunkLoadError' }), {
            source: 'sentry_sdk_load',
        })
        expect(unhandled).not.toHaveBeenCalled()
    })
})

export {}
