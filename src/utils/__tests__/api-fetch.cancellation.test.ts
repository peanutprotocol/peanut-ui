import { apiFetch, serverFetch } from '@/utils/api-fetch'
import { authReady } from '@/utils/auth-token'
import { getCachedBinaryVersion } from '@/utils/app-version'
import { isCapacitor } from '@/utils/capacitor'
import { fetchWithSentry } from '@/utils/sentry.utils'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn(),
    getAuthToken: jest.fn(() => 'token'),
    getAuthHeaders: jest.fn((extra) => ({ Authorization: 'Bearer token', ...extra })),
}))
jest.mock('@/utils/sentry.utils', () => ({ fetchWithSentry: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn() }))
jest.mock('@/utils/app-version', () => ({ getCachedBinaryVersion: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: jest.fn(() => false) }))
jest.mock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: false }))
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: jest.fn(() => false) }))
jest.mock('@/i18n/app/locale-store', () => ({ currentAppLocale: jest.fn(() => null) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.test.com' }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

const releaseGates: Array<() => void> = []

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    releaseGates.push(() => resolve(undefined as T))
    return { promise, resolve, reject }
}

function observe(promise: Promise<Response>) {
    const state: { status: 'pending' | 'resolved' | 'rejected'; value?: unknown } = { status: 'pending' }
    void promise.then(
        (value) => {
            state.status = 'resolved'
            state.value = value
        },
        (value: unknown) => {
            state.status = 'rejected'
            state.value = value
        }
    )
    return state
}

// A finite microtask budget makes a parked request fail an assertion, not hang Jest.
async function flush() {
    for (let i = 0; i < 24; i++) await Promise.resolve()
}

function watchListeners(signal: AbortSignal) {
    const add = jest.spyOn(signal, 'addEventListener')
    const remove = jest.spyOn(signal, 'removeEventListener')
    return () => {
        const added = add.mock.calls.filter(([event]) => event === 'abort')
        expect(added.length).toBeGreaterThan(0)
        for (const [, listener] of added) {
            expect(remove.mock.calls.some(([event, removed]) => event === 'abort' && removed === listener)).toBe(true)
        }
    }
}

function expectNoCancellationReporting() {
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
}

const response = { ok: true, status: 200, headers: new Headers() } as Response

beforeEach(() => {
    jest.clearAllMocks()
    ;(authReady as jest.Mock).mockResolvedValue(undefined)
    ;(getCachedBinaryVersion as jest.Mock).mockResolvedValue('1.2.3')
    ;(isCapacitor as jest.Mock).mockReturnValue(false)
    ;(fetchWithSentry as jest.Mock).mockResolvedValue(response)
})
afterEach(async () => {
    for (const release of releaseGates.splice(0)) release()
    await flush()
    jest.restoreAllMocks()
})

describe.each([
    ['apiFetch', apiFetch],
    ['serverFetch', serverFetch],
] as const)('%s cancellation', (_name, fetchApi) => {
    test.each([new Error('caller stopped'), { code: 'route-changed' }, 'stopped', false])(
        'preserves a non-nullish pre-abort reason: %p',
        async (reason) => {
            const controller = new AbortController()
            controller.abort(reason)
            const state = observe(fetchApi('/private', { signal: controller.signal }))
            await flush()
            expect(state).toEqual({ status: 'rejected', value: reason })
            expect(state.value).toBe(reason)
            expect(fetchWithSentry).not.toHaveBeenCalled()
            expectNoCancellationReporting()
        }
    )

    test('preserves the default platform abort reason', async () => {
        const controller = new AbortController()
        controller.abort()
        const state = observe(fetchApi('/private', { signal: controller.signal }))
        await flush()
        expect(state.status).toBe('rejected')
        expect(state.value).toBe(controller.signal.reason)
        expect(fetchWithSentry).not.toHaveBeenCalled()
        expectNoCancellationReporting()
    })

    test('uses AbortError for a null reason, including public reads', async () => {
        const controller = new AbortController()
        controller.abort(null)
        const state = observe(fetchApi('/public', { includeAuth: false, signal: controller.signal }))
        await flush()
        expect(state.status).toBe('rejected')
        expect(state.value).toBeInstanceOf(Error)
        expect(state.value).toMatchObject({ name: 'AbortError', message: 'The request was cancelled' })
        expect(authReady).not.toHaveBeenCalled()
        expect(fetchWithSentry).not.toHaveBeenCalled()
        expectNoCancellationReporting()
    })

    test.each(['resolve', 'reject'] as const)(
        'cancels only its auth waiter when shared readiness later %ss',
        async (completion) => {
            const gate = deferred<void>()
            ;(authReady as jest.Mock).mockReturnValue(gate.promise)
            const controller = new AbortController()
            const assertCleaned = watchListeners(controller.signal)
            const reason = { cancelled: true }
            const cancelled = observe(fetchApi('/cancelled', { signal: controller.signal }))
            const survivor = observe(fetchApi('/survivor'))
            await flush()
            expect(authReady).toHaveBeenCalledTimes(2)
            controller.abort(reason)
            await flush()
            expect(cancelled).toEqual({ status: 'rejected', value: reason })
            expect(cancelled.value).toBe(reason)
            expect(survivor.status).toBe('pending')
            expect(fetchWithSentry).not.toHaveBeenCalled()
            assertCleaned()
            expectNoCancellationReporting()
            const gateError = new Error('auth unavailable')
            if (completion === 'resolve') gate.resolve(undefined)
            else gate.reject(gateError)
            await flush()
            expect(cancelled.value).toBe(reason)
            if (completion === 'resolve') {
                expect(survivor).toEqual({ status: 'resolved', value: response })
                expect(fetchWithSentry).toHaveBeenCalledTimes(1)
            } else {
                expect(survivor.status).toBe('rejected')
                expect(survivor.value).toBe(gateError)
                expect(fetchWithSentry).not.toHaveBeenCalled()
            }
        }
    )
})

test('native binary cancellation leaves another caller parked until the shared version resolves', async () => {
    const gate = deferred<string>()
    ;(isCapacitor as jest.Mock).mockReturnValue(true)
    ;(getCachedBinaryVersion as jest.Mock).mockReturnValue(gate.promise)
    const controller = new AbortController()
    const assertCleaned = watchListeners(controller.signal)
    const cancelled = observe(apiFetch('/cancelled', { includeAuth: false, signal: controller.signal }))
    const survivor = observe(apiFetch('/survivor', { includeAuth: false }))
    await flush()
    expect(getCachedBinaryVersion).toHaveBeenCalledTimes(2)
    const reason = new Error('screen closed')
    controller.abort(reason)
    await flush()
    expect(cancelled.status).toBe('rejected')
    expect(cancelled.value).toBe(reason)
    expect(survivor.status).toBe('pending')
    expect(fetchWithSentry).not.toHaveBeenCalled()
    assertCleaned()
    expectNoCancellationReporting()
    gate.resolve('1.2.3')
    await flush()
    expect(survivor).toEqual({ status: 'resolved', value: response })
    expect(fetchWithSentry).toHaveBeenCalledTimes(1)
})

test.each(['auth', 'binary'] as const)(
    '%s gate rejection preserves identity and removes its listener',
    async (kind) => {
        const gate = deferred<never>()
        ;(isCapacitor as jest.Mock).mockReturnValue(kind === 'binary')
        const gateMock = (kind === 'auth' ? authReady : getCachedBinaryVersion) as jest.Mock
        gateMock.mockReturnValue(gate.promise)
        const controller = new AbortController()
        const assertCleaned = watchListeners(controller.signal)
        const state = observe(apiFetch('/private', { signal: controller.signal }))
        await flush()
        const error = new Error('gate failed')
        gate.reject(error)
        await flush()
        expect(state.status).toBe('rejected')
        expect(state.value).toBe(error)
        expect(fetchWithSentry).not.toHaveBeenCalled()
        assertCleaned()
    }
)

test('successful gates remove listeners and forward beforeDispatch without evaluating it', async () => {
    const auth = deferred<void>()
    const binary = deferred<string>()
    ;(authReady as jest.Mock).mockReturnValue(auth.promise)
    ;(isCapacitor as jest.Mock).mockReturnValue(true)
    ;(getCachedBinaryVersion as jest.Mock).mockReturnValue(binary.promise)
    const controller = new AbortController()
    const assertCleaned = watchListeners(controller.signal)
    const beforeDispatch = jest.fn(() => false)
    const state = observe(apiFetch('/private', { signal: controller.signal, beforeDispatch }))
    await flush()
    expect(beforeDispatch).not.toHaveBeenCalled()
    expect(fetchWithSentry).not.toHaveBeenCalled()
    auth.resolve(undefined)
    await flush()
    expect(beforeDispatch).not.toHaveBeenCalled()
    expect(fetchWithSentry).not.toHaveBeenCalled()
    binary.resolve('1.2.3')
    await flush()
    expect(state).toEqual({ status: 'resolved', value: response })
    expect(beforeDispatch).not.toHaveBeenCalled()
    expect(fetchWithSentry).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ beforeDispatch }))
    assertCleaned()
})

test('aborting at auth resolution prevents dispatch', async () => {
    const gate = deferred<void>()
    ;(authReady as jest.Mock).mockReturnValue(gate.promise)
    const controller = new AbortController()
    const state = observe(apiFetch('/private', { signal: controller.signal }))
    await flush()
    gate.resolve(undefined)
    controller.abort('boundary cancellation')
    await flush()
    expect(state).toEqual({ status: 'rejected', value: 'boundary cancellation' })
    expect(fetchWithSentry).not.toHaveBeenCalled()
    expectNoCancellationReporting()
})

test('a public native read with an explicit mixed-case binary header skips both gates', async () => {
    ;(isCapacitor as jest.Mock).mockReturnValue(true)
    const state = observe(apiFetch('/public', { includeAuth: false, headers: { 'X-App-Binary-Version': '9.8.7' } }))
    await flush()
    expect(state).toEqual({ status: 'resolved', value: response })
    expect(authReady).not.toHaveBeenCalled()
    expect(getCachedBinaryVersion).not.toHaveBeenCalled()
    expect(fetchWithSentry).toHaveBeenCalledTimes(1)
})
