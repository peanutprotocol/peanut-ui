/** @jest-environment node */

import { canUseNativeHttp, nativeHttpRequest } from '../native-http'
import { fetchWithSentry, resolveDefaultTimeoutMs, TRANSPORT_TIMEOUT_RETRY_DELAY_MS } from '../sentry.utils'

jest.mock('@sentry/nextjs', () => ({
    withScope: jest.fn((callback) => callback({ setFingerprint: jest.fn(), setTag: jest.fn() })),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('@/utils/sentry-lazy', () => require('@sentry/nextjs'))
jest.mock('../connectivity', () => ({
    getConnectivityGeneration: jest.fn(() => 0),
    reportNetworkError: jest.fn(),
    hasRecentFailure: jest.fn(() => false),
}))
jest.mock('../native-http', () => ({ canUseNativeHttp: jest.fn(() => false), nativeHttpRequest: jest.fn() }))

const url = 'https://api.peanut.me/sumsub/initiate'
const originalFetch = global.fetch
const controllers: ReadableStreamDefaultController<Uint8Array>[] = []

function streamingResponse(status = 200) {
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controllers.push(controller)
            controller.enqueue(new TextEncoder().encode('{"token":'))
        },
    })
    return new Response(stream, { status, headers: { 'Content-Type': 'application/json' } })
}

function observe<T>(promise: Promise<T>) {
    const outcome: { state: 'pending' | 'fulfilled' | 'rejected'; error?: unknown } = { state: 'pending' }
    void promise.then(
        () => (outcome.state = 'fulfilled'),
        (error: unknown) => {
            outcome.state = 'rejected'
            outcome.error = error
        }
    )
    return outcome
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.mocked(canUseNativeHttp).mockReturnValue(false)
    jest.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(async () => {
    for (const controller of controllers.splice(0)) {
        try {
            controller.error(new Error('test stream cleanup'))
        } catch {
            // A completed or cancelled stream needs no further cleanup.
        }
    }
    await Promise.resolve()
    global.fetch = originalFetch
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
})

it.each(['json', 'text'] as const)(
    'bounds a successful response whose %s body stalls after headers',
    async (reader) => {
        global.fetch = jest.fn().mockResolvedValue(streamingResponse())
        const outcome = observe(fetchWithSentry(url, { method: 'POST' }, 1_000).then((response) => response[reader]()))

        await jest.advanceTimersByTimeAsync(1_001)

        expect(outcome.state).toBe('rejected')
        expect(outcome.error).toMatchObject({
            name: 'MutationResponseTimeoutError',
            responseReceived: true,
            outcomeUnknown: true,
        })
        expect(global.fetch).toHaveBeenCalledTimes(1)
    }
)

it('uses the remaining budget after slow headers instead of resetting a body timer', async () => {
    global.fetch = jest.fn(
        () => new Promise<Response>((resolve) => setTimeout(() => resolve(streamingResponse()), 700))
    )
    const outcome = observe(fetchWithSentry(url, { method: 'POST' }, 1_000).then((response) => response.json()))

    await jest.advanceTimersByTimeAsync(999)
    expect(outcome.state).toBe('pending')
    await jest.advanceTimersByTimeAsync(2)

    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toMatchObject({
        name: 'MutationResponseTimeoutError',
        responseReceived: true,
        outcomeUnknown: true,
    })
})

it('bounds telemetry reading a non-OK response body', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamingResponse(503))
    const outcome = observe(fetchWithSentry(url, { method: 'POST' }, 1_000))

    await jest.advanceTimersByTimeAsync(1_001)

    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toMatchObject({
        name: 'MutationResponseTimeoutError',
        responseReceived: true,
        outcomeUnknown: true,
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
})

it('applies the effective environment default budget to response consumption too', async () => {
    // Real Response streams run under Node, which uses the existing server default.
    const timeoutMs = resolveDefaultTimeoutMs(true)
    global.fetch = jest.fn().mockResolvedValue(streamingResponse())
    const outcome = observe(fetchWithSentry(url, { method: 'POST' }).then((response) => response.json()))

    await jest.advanceTimersByTimeAsync(timeoutMs - 1)
    expect(outcome.state).toBe('pending')
    await jest.advanceTimersByTimeAsync(2)

    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toMatchObject({
        name: 'MutationResponseTimeoutError',
        responseReceived: true,
        outcomeUnknown: true,
    })
})

it('preserves normal Response status, headers, clones, JSON, and text for a completed body', async () => {
    const body = JSON.stringify({ token: 'ready-token' })
    global.fetch = jest.fn().mockResolvedValue(
        new Response(body, {
            status: 201,
            statusText: 'Created',
            headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'deadline-success' },
        })
    )

    const response = await fetchWithSentry(url, { method: 'POST' }, 1_000)

    expect(response.status).toBe(201)
    expect(response.statusText).toBe('Created')
    expect(response.ok).toBe(true)
    expect(response.headers.get('x-request-id')).toBe('deadline-success')
    const copy = response.clone()
    await expect(copy.json()).resolves.toEqual({ token: 'ready-token' })
    await expect(response.text()).resolves.toBe(body)
})

it('cancels a stalled body immediately without reporting a network failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamingResponse())
    const caller = new AbortController()
    const outcome = observe(fetchWithSentry(url, { method: 'POST', signal: caller.signal }, 1_000))
    await jest.advanceTimersByTimeAsync(1)
    caller.abort()
    await jest.advanceTimersByTimeAsync(1)
    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toMatchObject({ name: 'AbortError' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
})

it('retains the existing GET retry when the first body stalls', async () => {
    global.fetch = jest
        .fn()
        .mockResolvedValueOnce(streamingResponse())
        .mockResolvedValueOnce(new Response('{"ready":true}'))
    const request = fetchWithSentry(url, {}, 1_000)
    const outcome = observe(request)
    await jest.advanceTimersByTimeAsync(1_001 + TRANSPORT_TIMEOUT_RETRY_DELAY_MS)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(outcome.state).toBe('fulfilled')
    await expect((await request).json()).resolves.toEqual({ ready: true })
})

it.each([
    [false, 'broken'],
    [true, 'broken'],
    [false, 'stalled'],
    [true, 'stalled'],
] as const)('never replays a native POST after 201 headers (idempotent=%s, body=%s)', async (idempotent, failure) => {
    jest.mocked(canUseNativeHttp).mockReturnValue(true)
    const response = streamingResponse(201)
    if (failure === 'broken') controllers[controllers.length - 1].error(new TypeError('Failed to fetch'))
    jest.mocked(nativeHttpRequest).mockResolvedValue(response)
    global.fetch = jest.fn().mockResolvedValue(new Response('{"created":true}', { status: 201 }))
    const outcome = observe(fetchWithSentry(url, { method: 'POST', preferNativeTransport: true, idempotent }, 1_000))

    await jest.advanceTimersByTimeAsync(2_000 + TRANSPORT_TIMEOUT_RETRY_DELAY_MS)

    expect(outcome.state).toBe('rejected')
    expect(nativeHttpRequest).toHaveBeenCalledTimes(1)
    expect(global.fetch).not.toHaveBeenCalled()
})

it.each([false, true])('returns undrained headers and permits a body after 60 seconds (native=%s)', async (native) => {
    jest.mocked(canUseNativeHttp).mockReturnValue(native)
    const response = streamingResponse()
    const controller = controllers[controllers.length - 1]
    jest.mocked(nativeHttpRequest).mockResolvedValue(response)
    global.fetch = jest.fn().mockResolvedValue(response)
    const options = { method: 'GET', preferNativeTransport: native, drainResponseBody: false }
    const request = fetchWithSentry(url, options, 60_000)
    const outcome = observe(request)
    await jest.advanceTimersByTimeAsync(1)
    expect(outcome.state).toBe('fulfilled')
    const headers = await request
    expect(headers.status).toBe(200)
    const body = headers.text()
    const bodyOutcome = observe(body)
    await jest.advanceTimersByTimeAsync(60_001)
    expect(bodyOutcome.state).toBe('pending')
    controller.enqueue(new TextEncoder().encode('"late"}'))
    controller.close()
    await expect(body).resolves.toBe('{"token":"late"}')
    expect(nativeHttpRequest).toHaveBeenCalledTimes(native ? 1 : 0)
    expect(global.fetch).toHaveBeenCalledTimes(native ? 0 : 1)
    const init = native ? jest.mocked(nativeHttpRequest).mock.calls[0][1] : (global.fetch as jest.Mock).mock.calls[0][1]
    expect(init).not.toHaveProperty('drainResponseBody')
})

it('preserves the caller cancellation reason after native mutation headers', async () => {
    jest.mocked(canUseNativeHttp).mockReturnValue(true)
    jest.mocked(nativeHttpRequest).mockResolvedValue(streamingResponse(201))
    global.fetch = jest.fn()
    const caller = new AbortController()
    const reason = new Error('Caller retired this request')
    const outcome = observe(
        fetchWithSentry(url, { method: 'POST', preferNativeTransport: true, signal: caller.signal }, 1_000)
    )
    await jest.advanceTimersByTimeAsync(1)
    caller.abort(reason)
    await jest.advanceTimersByTimeAsync(1)
    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toBe(reason)
    expect(nativeHttpRequest).toHaveBeenCalledTimes(1)
    expect(global.fetch).not.toHaveBeenCalled()
})

it.each([false, true])('never falls back after a WebView POST body breaks (idempotent=%s)', async (idempotent) => {
    jest.mocked(canUseNativeHttp).mockReturnValue(true)
    const response = streamingResponse(201)
    controllers[controllers.length - 1].error(new TypeError('Failed to fetch'))
    global.fetch = jest.fn().mockResolvedValue(response)
    jest.mocked(nativeHttpRequest).mockResolvedValue(new Response('{"created":true}', { status: 201 }))
    const outcome = observe(fetchWithSentry(url, { method: 'POST', idempotent }, 1_000))
    await jest.advanceTimersByTimeAsync(2_000 + TRANSPORT_TIMEOUT_RETRY_DELAY_MS)
    expect(outcome.state).toBe('rejected')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(nativeHttpRequest).not.toHaveBeenCalled()
})
