/**
 * The lazy wrapper must call the SDK synchronously once it is loaded: the real
 * SDK pops a `withScope` fork the moment the callback returns, so a capture
 * deferred to a later microtask lands on the outer scope and loses the
 * fingerprint the callback set. The mock below reproduces exactly that
 * scope-stack behaviour and records the CURRENT scope at capture time.
 */
type FakeScope = {
    fingerprint?: string[]
    tags: Record<string, string>
    setFingerprint: (fingerprint: string[]) => void
    setTag: (key: string, value: string) => void
}

type Captured = {
    kind: 'exception' | 'message'
    payload: unknown
    fingerprint?: string[]
    tags: Record<string, string>
}

type FakeSdk = {
    __captured: Captured[]
    withScope: (cb: (scope: FakeScope) => unknown) => void
    captureException: (error: unknown) => void
    captureMessage: (message: string) => void
    setUser: jest.Mock
}

jest.mock('@sentry/nextjs', () => {
    const makeScope = (parent?: FakeScope): FakeScope => ({
        fingerprint: parent?.fingerprint,
        tags: { ...(parent?.tags ?? {}) },
        setFingerprint(fingerprint) {
            this.fingerprint = fingerprint
        },
        setTag(key, value) {
            this.tags[key] = value
        },
    })
    const stack: FakeScope[] = [makeScope()]
    const current = () => stack[stack.length - 1]
    const captured: Captured[] = []
    const record = (kind: Captured['kind'], payload: unknown) =>
        captured.push({ kind, payload, fingerprint: current().fingerprint, tags: { ...current().tags } })
    return {
        __captured: captured,
        withScope: (cb: (scope: FakeScope) => unknown) => {
            stack.push(makeScope(current()))
            try {
                cb(current())
            } finally {
                stack.pop()
            }
        },
        captureException: (error: unknown) => record('exception', error),
        captureMessage: (message: string) => record('message', message),
        setUser: jest.fn(),
    }
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function fresh() {
    jest.resetModules()
    const lazy = require('../sentry-lazy') as typeof import('../sentry-lazy')
    const sdk = require('@sentry/nextjs') as FakeSdk
    return { lazy, sdk }
}

describe('sentry-lazy — scope survives to the capture', () => {
    it('keeps the fingerprint set inside withScope once the SDK is loaded', async () => {
        const { lazy, sdk } = fresh()
        await lazy.loadSentry()

        lazy.withScope((scope) => {
            scope.setFingerprint(['network-error', '/charges', 'POST'])
            scope.setTag('feature', 'charges')
            lazy.captureException(new Error('boom'))
            lazy.captureMessage('boom message')
        })

        expect(sdk.__captured).toHaveLength(2)
        expect(sdk.__captured[0]).toMatchObject({
            kind: 'exception',
            fingerprint: ['network-error', '/charges', 'POST'],
            tags: { feature: 'charges' },
        })
        expect(sdk.__captured[1]).toMatchObject({
            kind: 'message',
            fingerprint: ['network-error', '/charges', 'POST'],
        })
    })

    it('does not leak the forked scope into later captures', async () => {
        const { lazy, sdk } = fresh()
        await lazy.loadSentry()

        lazy.withScope((scope) => {
            scope.setFingerprint(['scoped'])
            lazy.captureMessage('inside')
        })
        lazy.captureMessage('outside')

        expect(sdk.__captured[1]).toMatchObject({ payload: 'outside', fingerprint: undefined })
    })

    it('still delivers calls made before the SDK loaded', async () => {
        const { lazy, sdk } = fresh()

        lazy.captureException(new Error('early'))
        lazy.setUser({ id: 'u1' })
        expect(sdk.__captured).toHaveLength(0)

        await flush()
        expect(sdk.__captured).toHaveLength(1)
        expect(sdk.__captured[0]).toMatchObject({ kind: 'exception' })
        expect(sdk.setUser).toHaveBeenCalledWith({ id: 'u1' })
    })
})

describe('fetchWithSentry through the real lazy wrapper', () => {
    let infoSpy: jest.SpyInstance

    beforeEach(() => {
        infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    })

    afterEach(() => infoSpy.mockRestore())

    // The fingerprint is what root sentry.utils' isFetchSiteMutationFailure
    // rescues failed mutations by; if it does not reach the capture, every
    // failed POST is swallowed by the networkIssues pattern.
    it('captures a failed POST with the network-error fingerprint on the scope', async () => {
        const { lazy, sdk } = fresh()
        const { fetchWithSentry, sanitizeUrl } = require('../sentry.utils') as typeof import('../sentry.utils')
        await lazy.loadSentry()

        global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        const url = 'https://api.peanut.me/charges'
        await expect(fetchWithSentry(url, { method: 'POST', body: '{}' })).rejects.toThrow(
            'Something went wrong. Please try again.'
        )

        expect(sdk.__captured).toHaveLength(1)
        expect(sdk.__captured[0]).toMatchObject({
            kind: 'exception',
            fingerprint: ['network-error', sanitizeUrl(url), 'POST'],
        })
    })
})
