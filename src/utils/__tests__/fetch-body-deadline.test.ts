/** @jest-environment node */

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
        expect(outcome.error).toMatchObject({ name: 'ConnectionTimeoutError' })
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
    expect(outcome.error).toMatchObject({ name: 'ConnectionTimeoutError' })
})

it('bounds telemetry reading a non-OK response body', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamingResponse(503))
    const outcome = observe(fetchWithSentry(url, { method: 'POST' }, 1_000))

    await jest.advanceTimersByTimeAsync(1_001)

    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toMatchObject({ name: 'ConnectionTimeoutError' })
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
    expect(outcome.error).toMatchObject({ name: 'ConnectionTimeoutError' })
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
