import { fetchWithSentry } from '../sentry.utils'
import { __resetConnectivityForTests, getRecentFailures, setConnectivityAppActive } from '../connectivity'
import { canUseNativeHttp, nativeHttpRequest } from '../native-http'
import * as Sentry from '@/utils/sentry-lazy'

jest.mock('@/utils/sentry-lazy', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    withScope: jest.fn((cb: (scope: unknown) => void) => cb({ setFingerprint: jest.fn(), setTag: jest.fn() })),
}))

jest.mock('../native-http', () => ({
    canUseNativeHttp: jest.fn(() => false),
    nativeHttpRequest: jest.fn(),
}))

const originalFetch = global.fetch
let infoSpy: jest.SpyInstance

beforeEach(() => {
    jest.clearAllMocks()
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

it('ignores an overdue timeout from a suspended WebView and its transport retry', async () => {
    jest.useFakeTimers()
    try {
        global.fetch = jest.fn(
            (_url, options) =>
                new Promise<Response>((_resolve, reject) => {
                    options?.signal?.addEventListener('abort', () =>
                        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
                    )
                })
        )
        const outcome = fetchWithSentry('https://api.peanut.me/users/me', {}, 1000).catch((error: unknown) => error)
        setConnectivityAppActive(false)
        jest.setSystemTime(Date.now() + 60_000)
        setConnectivityAppActive(true)
        await jest.advanceTimersByTimeAsync(2000)
        expect(await outcome).toMatchObject({ name: 'ConnectionTimeoutError' })
        expect(getRecentFailures()).toBe(0)
        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    } finally {
        jest.useRealTimers()
    }
})
