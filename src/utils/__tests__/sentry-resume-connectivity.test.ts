import { fetchWithSentry, TRANSPORT_TIMEOUT_RETRY_DELAY_MS } from '../sentry.utils'
import { __resetConnectivityForTests, getRecentFailures, setConnectivityAppActive } from '../connectivity'
import { canUseNativeHttp, nativeHttpRequest } from '../native-http'
import * as Sentry from '@/utils/sentry-lazy'

const mockScopes: Array<{ setFingerprint: jest.Mock; setTag: jest.Mock }> = []
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    withScope: jest.fn((cb: (scope: unknown) => void) => {
        const scope = { setFingerprint: jest.fn(), setTag: jest.fn() }
        mockScopes.push(scope)
        cb(scope)
    }),
}))

jest.mock('../native-http', () => ({
    canUseNativeHttp: jest.fn(() => false),
    nativeHttpRequest: jest.fn(),
}))

const originalFetch = global.fetch
let infoSpy: jest.SpyInstance

beforeEach(() => {
    jest.clearAllMocks()
    mockScopes.length = 0
    __resetConnectivityForTests()
    jest.mocked(canUseNativeHttp).mockReturnValue(false)
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
    __resetConnectivityForTests()
    infoSpy.mockRestore()
    global.fetch = originalFetch
})

function pendingFailure(method = 'GET', preferNativeTransport = false) {
    let reject!: (error: Error) => void
    const pending = new Promise<Response>((_resolve, rejectPromise) => {
        reject = rejectPromise
    })
    global.fetch = jest.fn(() => pending)
    const outcome = fetchWithSentry('https://api.peanut.me/users/me', { method, preferNativeTransport }).catch(
        (error: unknown) => error
    )
    return { reject, outcome }
}

it('does not turn a pre-background request into a new connection failure after resume', async () => {
    const request = pendingFailure()
    setConnectivityAppActive(false)
    setConnectivityAppActive(true)
    request.reject(new TypeError('Failed to fetch'))
    expect(await request.outcome).toMatchObject({ name: 'ServiceUnavailableError' })
    expect(getRecentFailures()).toBe(0)

    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchWithSentry('https://api.peanut.me/users/me')).rejects.toThrow()
    await expect(fetchWithSentry('https://api.peanut.me/users/history')).rejects.toThrow()
    expect(getRecentFailures()).toBe(2)
    expect(Sentry.captureException).toHaveBeenCalledTimes(2)
})

it('does not count requests started while backgrounded', async () => {
    setConnectivityAppActive(false)
    const request = pendingFailure()
    setConnectivityAppActive(true)
    request.reject(new TypeError('Failed to fetch'))
    await request.outcome
    expect(getRecentFailures()).toBe(0)
})

it('still throws and captures an interrupted mutation without retrying it', async () => {
    const request = pendingFailure('POST')
    setConnectivityAppActive(false)
    setConnectivityAppActive(true)
    request.reject(new TypeError('Failed to fetch'))
    expect(await request.outcome).toMatchObject({ name: 'ServiceUnavailableError' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(getRecentFailures()).toBe(0)
})

it('keeps the original generation across the native transport fallback', async () => {
    jest.mocked(canUseNativeHttp).mockReturnValue(true)
    jest.mocked(nativeHttpRequest).mockImplementation(async () => {
        setConnectivityAppActive(false)
        setConnectivityAppActive(true)
        throw new TypeError('Native transport interrupted')
    })
    const request = pendingFailure()
    request.reject(new TypeError('Failed to fetch'))
    await request.outcome
    expect(nativeHttpRequest).toHaveBeenCalledTimes(1)
    expect(getRecentFailures()).toBe(0)
})

it('captures the generation before attempting the preferred native transport', async () => {
    jest.mocked(canUseNativeHttp).mockReturnValue(true)
    jest.mocked(nativeHttpRequest).mockImplementation(async () => {
        setConnectivityAppActive(false)
        setConnectivityAppActive(true)
        throw new TypeError('Native transport interrupted')
    })
    const request = pendingFailure('GET', true)
    request.reject(new TypeError('Failed to fetch'))
    await request.outcome
    expect(getRecentFailures()).toBe(0)
})

const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' })

// Each leg hangs until its own timer aborts it; `answers` resolves legs in order.
function stallingFetch(answers: Array<'stall' | 'ok'> = []) {
    global.fetch = jest.fn(
        (_url, options) =>
            new Promise<Response>((resolve, reject) => {
                if (answers.shift() === 'ok') return resolve({ ok: true, status: 200 } as Response)
                options?.signal?.addEventListener('abort', () => reject(abortError()))
            })
    )
}

describe('a request interrupted by an app or tab suspension', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('gets one fresh foreground leg after resume instead of a spent budget', async () => {
        stallingFetch(['stall', 'ok'])
        const outcome = fetchWithSentry('https://api.peanut.me/users/me', {}, 1000)
        setConnectivityAppActive(false)
        jest.setSystemTime(Date.now() + 60_000)
        setConnectivityAppActive(true)
        await jest.advanceTimersByTimeAsync(1000 + TRANSPORT_TIMEOUT_RETRY_DELAY_MS)

        await expect(outcome).resolves.toMatchObject({ ok: true })
        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(getRecentFailures()).toBe(0)
    })

    it('reports the fresh leg when it also stalls in the foreground', async () => {
        stallingFetch()
        const outcome = fetchWithSentry('https://api.peanut.me/users/me', {}, 1000).catch((error: unknown) => error)
        setConnectivityAppActive(false)
        jest.setSystemTime(Date.now() + 60_000)
        setConnectivityAppActive(true)
        await jest.advanceTimersByTimeAsync(1000 + TRANSPORT_TIMEOUT_RETRY_DELAY_MS + 1000)

        const error = await outcome
        expect(error).toMatchObject({ name: 'ConnectionTimeoutError' })
        expect((error as { interrupted?: boolean }).interrupted).toBeUndefined()
        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        expect(mockScopes[0].setFingerprint).toHaveBeenCalledWith(['timeout'])
    })

    it('detects a suspension from a late timer when no lifecycle event arrives (web)', async () => {
        stallingFetch(['stall', 'ok'])
        const outcome = fetchWithSentry('https://api.peanut.me/rain/cards', {}, 1000)
        jest.setSystemTime(Date.now() + 60_000)
        await jest.advanceTimersByTimeAsync(1000 + TRANSPORT_TIMEOUT_RETRY_DELAY_MS)

        await expect(outcome).resolves.toMatchObject({ ok: true })
        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('leaves a read stalled while still backgrounded to the focus refetch, unreported', async () => {
        stallingFetch()
        const outcome = fetchWithSentry('https://api.peanut.me/card', {}, 1000).catch((error: unknown) => error)
        setConnectivityAppActive(false)
        await jest.advanceTimersByTimeAsync(1000)

        expect(await outcome).toMatchObject({ name: 'ConnectionTimeoutError', interrupted: true })
        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Request interrupted by app suspension' })
        )
    })

    it('reports an interrupted mutation on its own fingerprint and never retries it', async () => {
        stallingFetch()
        const outcome = fetchWithSentry('https://api.peanut.me/users/identity', { method: 'POST' }, 1000).catch(
            (error: unknown) => error
        )
        setConnectivityAppActive(false)
        jest.setSystemTime(Date.now() + 60_000)
        setConnectivityAppActive(true)
        await jest.advanceTimersByTimeAsync(1000)

        expect(await outcome).toMatchObject({ name: 'ConnectionTimeoutError', interrupted: true })
        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        expect(jest.mocked(Sentry.captureException).mock.calls[0][1]).toMatchObject({ level: 'warning' })
        expect(mockScopes[0].setFingerprint).toHaveBeenCalledWith(['timeout', 'interrupted'])
        expect(mockScopes[0].setTag).toHaveBeenCalledWith('request.interrupted', 'true')
    })

    it('still reports a foreground timeout of both legs as before', async () => {
        stallingFetch()
        const outcome = fetchWithSentry('https://api.peanut.me/users/me', {}, 1000).catch((error: unknown) => error)
        await jest.advanceTimersByTimeAsync(1000 + TRANSPORT_TIMEOUT_RETRY_DELAY_MS + 1000)

        expect(await outcome).toMatchObject({ name: 'ConnectionTimeoutError' })
        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        expect(jest.mocked(Sentry.captureException).mock.calls[0][1]).toMatchObject({ level: 'error' })
    })
})
