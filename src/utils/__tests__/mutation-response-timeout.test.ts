/** @jest-environment node */

import * as Sentry from '@sentry/nextjs'
import { reportNetworkError } from '../connectivity'
import { canUseNativeHttp, nativeHttpRequest } from '../native-http'
import * as transport from '../sentry.utils'

jest.mock('@sentry/nextjs', () => ({
    withScope: jest.fn(),
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

const url = 'https://api.peanut.me/test/mutations'
const timeoutMs = 1_000
const originalFetch = global.fetch
const controllers: ReadableStreamDefaultController<Uint8Array>[] = []
const scope = { setFingerprint: jest.fn(), setTag: jest.fn() }
const timeoutExports = transport as unknown as Record<string, new (...args: any[]) => Error>

type Outcome = { state: 'pending' | 'fulfilled' | 'rejected'; error?: unknown }
type Transport = 'webview' | 'native-first' | 'native-fallback'

function streamingResponse(status: number) {
    return new Response(
        new ReadableStream<Uint8Array>({
            start(controller) {
                controllers.push(controller)
                controller.enqueue(new TextEncoder().encode('{"ready":'))
            },
        }),
        { status, headers: { 'Content-Type': 'application/json' } }
    )
}

function observe(promise: Promise<unknown>): Outcome {
    const outcome: Outcome = { state: 'pending' }
    void promise.then(
        () => (outcome.state = 'fulfilled'),
        (error: unknown) => {
            outcome.state = 'rejected'
            outcome.error = error
        }
    )
    return outcome
}

function arrangeStalledResponse(selectedTransport: Transport, status: number) {
    jest.mocked(canUseNativeHttp).mockReturnValue(true)
    if (selectedTransport === 'webview') {
        global.fetch = jest.fn().mockResolvedValue(streamingResponse(status))
        jest.mocked(nativeHttpRequest).mockResolvedValue(new Response('{"replayed":true}'))
    } else {
        jest.mocked(nativeHttpRequest).mockResolvedValue(streamingResponse(status))
        global.fetch =
            selectedTransport === 'native-fallback'
                ? jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
                : jest.fn().mockResolvedValue(new Response('{"replayed":true}'))
    }
    return { preferNativeTransport: selectedTransport === 'native-first' }
}

async function exhaustTimeoutAndPossibleRetry() {
    await jest.advanceTimersByTimeAsync(3 * timeoutMs + transport.TRANSPORT_TIMEOUT_RETRY_DELAY_MS + 1)
}

function expectUnknownOutcome(outcome: Outcome, status: number) {
    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toMatchObject({
        name: 'MutationResponseTimeoutError',
        responseReceived: true,
        outcomeUnknown: true,
        status,
    })
    expect(outcome.error).toBeInstanceOf(timeoutExports.ConnectionTimeoutError)
    expect(outcome.error).toBeInstanceOf(timeoutExports.MutationResponseTimeoutError)
    expect(reportNetworkError).not.toHaveBeenCalled()
}

function expectUnknownOutcomeTelemetry(status: number) {
    expect(scope.setTag).toHaveBeenCalledWith('response_received', 'true')
    expect(scope.setTag).toHaveBeenCalledWith('http.status_code', String(status))
    expect(scope.setTag).toHaveBeenCalledWith('request.outcome', 'unknown')
    expect(scope.setFingerprint).toHaveBeenCalledWith(['mutation-response-timeout'])
    expect(
        (Sentry.captureException as jest.Mock).mock.calls.length +
            (Sentry.captureMessage as jest.Mock).mock.calls.length
    ).toBeGreaterThan(0)
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.mocked(canUseNativeHttp).mockReturnValue(false)
    ;(Sentry.withScope as jest.Mock).mockImplementation((callback: (value: typeof scope) => unknown) => callback(scope))
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

it('exports a typed timeout hierarchy with stable names', () => {
    expect(timeoutExports.ConnectionTimeoutError).toEqual(expect.any(Function))
    expect(timeoutExports.MutationResponseTimeoutError).toEqual(expect.any(Function))
    const ordinary = new timeoutExports.ConnectionTimeoutError('Request timed out')
    expect(ordinary).toBeInstanceOf(Error)
    expect(ordinary.name).toBe('ConnectionTimeoutError')
    expect(timeoutExports.MutationResponseTimeoutError.prototype).toBeInstanceOf(timeoutExports.ConnectionTimeoutError)
})

const webviewCases = ['POST', 'put', 'PaTcH', 'delete'].flatMap((method) =>
    [200, 201, 503].flatMap((status) => [false, true].map((idempotent) => ({ method, status, idempotent })))
)

it.each(webviewCases)(
    'classifies WebView $method status=$status body timeout without replay (idempotent=$idempotent)',
    async ({ method, status, idempotent }) => {
        const options = arrangeStalledResponse('webview', status)
        const outcome = observe(transport.fetchWithSentry(url, { ...options, method, idempotent }, timeoutMs))

        await exhaustTimeoutAndPossibleRetry()

        expectUnknownOutcome(outcome, status)
        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(nativeHttpRequest).not.toHaveBeenCalled()
        expectUnknownOutcomeTelemetry(status)
    }
)

const nativeCases = (['native-first', 'native-fallback'] as const).flatMap((selectedTransport) =>
    [200, 201, 503].flatMap((status) => [false, true].map((idempotent) => ({ selectedTransport, status, idempotent })))
)

it.each(nativeCases)(
    'classifies $selectedTransport mutation status=$status body timeout without replay (idempotent=$idempotent)',
    async ({ selectedTransport, status, idempotent }) => {
        const options = arrangeStalledResponse(selectedTransport, status)
        const outcome = observe(transport.fetchWithSentry(url, { ...options, method: 'POST', idempotent }, timeoutMs))

        await exhaustTimeoutAndPossibleRetry()

        expectUnknownOutcome(outcome, status)
        expect(nativeHttpRequest).toHaveBeenCalledTimes(1)
        // Explicit idempotency permits one WebView retry before any response arrives; headers forbid further replay.
        expect(global.fetch).toHaveBeenCalledTimes(selectedTransport === 'native-fallback' ? (idempotent ? 2 : 1) : 0)
        expectUnknownOutcomeTelemetry(status)
    }
)

it('keeps GET stalled-body failures as connection timeouts after the bounded retry', async () => {
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(streamingResponse(200)))
    const outcome = observe(transport.fetchWithSentry(url, { method: 'GET' }, timeoutMs))

    await exhaustTimeoutAndPossibleRetry()

    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toMatchObject({ name: 'ConnectionTimeoutError' })
    expect(outcome.error).toBeInstanceOf(timeoutExports.ConnectionTimeoutError)
    expect(outcome.error).not.toHaveProperty('responseReceived', true)
    expect(outcome.error).not.toHaveProperty('outcomeUnknown', true)
    expect(global.fetch).toHaveBeenCalledTimes(2)
})

it('keeps a mutation timeout before any headers as a connection timeout', async () => {
    global.fetch = jest.fn(
        (_input, init) =>
            new Promise<Response>((_resolve, reject) => {
                const signal = init?.signal
                if (!signal) throw new Error('The transport must supply an abort signal')
                signal.addEventListener('abort', () => reject(signal.reason), { once: true })
            })
    )
    const outcome = observe(transport.fetchWithSentry(url, { method: 'POST' }, timeoutMs))

    await exhaustTimeoutAndPossibleRetry()

    expect(outcome.state).toBe('rejected')
    expect(outcome.error).toMatchObject({ name: 'ConnectionTimeoutError' })
    expect(outcome.error).toBeInstanceOf(timeoutExports.ConnectionTimeoutError)
    expect(outcome.error).not.toHaveProperty('responseReceived', true)
    expect(outcome.error).not.toHaveProperty('outcomeUnknown', true)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(scope.setFingerprint).not.toHaveBeenCalledWith(['mutation-response-timeout'])
})

const cancellationCases = (['webview', 'native-first', 'native-fallback'] as const).flatMap((selectedTransport) =>
    [false, true].map((customReason) => ({ selectedTransport, customReason }))
)

it.each(cancellationCases)(
    'preserves caller cancellation after $selectedTransport headers (customReason=$customReason)',
    async ({ selectedTransport, customReason }) => {
        const options = arrangeStalledResponse(selectedTransport, 201)
        const caller = new AbortController()
        const reason = new Error('Caller retired this request')
        const outcome = observe(
            transport.fetchWithSentry(url, { ...options, method: 'POST', signal: caller.signal }, timeoutMs)
        )
        await jest.advanceTimersByTimeAsync(1)

        if (customReason) caller.abort(reason)
        else caller.abort()
        await exhaustTimeoutAndPossibleRetry()

        expect(outcome.state).toBe('rejected')
        if (customReason) expect(outcome.error).toBe(reason)
        else expect(outcome.error).toMatchObject({ name: 'AbortError' })
        expect(Sentry.captureMessage).not.toHaveBeenCalled()
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(reportNetworkError).not.toHaveBeenCalled()
        expect(global.fetch).toHaveBeenCalledTimes(selectedTransport === 'native-first' ? 0 : 1)
        expect(nativeHttpRequest).toHaveBeenCalledTimes(selectedTransport === 'webview' ? 0 : 1)
    }
)

it.each([{ silentTimeout: true }, { callerReportsFailures: true }])(
    'leaves an unknown-outcome status breadcrumb when capture is suppressed by %j',
    async (suppression) => {
        const options = arrangeStalledResponse('webview', 201)
        const outcome = observe(
            transport.fetchWithSentry(url, { ...options, ...suppression, method: 'POST' }, timeoutMs)
        )

        await exhaustTimeoutAndPossibleRetry()

        expectUnknownOutcome(outcome, 201)
        expect(Sentry.captureMessage).not.toHaveBeenCalled()
        expect(Sentry.captureException).not.toHaveBeenCalled()
        const breadcrumbs = JSON.stringify((Sentry.addBreadcrumb as jest.Mock).mock.calls)
        expect(breadcrumbs).toMatch(/unknown/i)
        expect(breadcrumbs).toContain('201')
    }
)

it('does not expose authorization or sensitive body values in timeout telemetry', async () => {
    const options = arrangeStalledResponse('webview', 201)
    const authorizationSecret = 'auth-secret-that-must-stay-private'
    const bodySecret = 'body-secret-that-must-stay-private'
    const outcome = observe(
        transport.fetchWithSentry(
            url,
            {
                ...options,
                method: 'POST',
                headers: { Authorization: `Bearer ${authorizationSecret}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: bodySecret }),
            },
            timeoutMs
        )
    )

    await exhaustTimeoutAndPossibleRetry()

    expectUnknownOutcome(outcome, 201)
    expectUnknownOutcomeTelemetry(201)
    const telemetry = JSON.stringify([
        (Sentry.captureMessage as jest.Mock).mock.calls,
        (Sentry.captureException as jest.Mock).mock.calls,
        (Sentry.addBreadcrumb as jest.Mock).mock.calls,
        scope.setTag.mock.calls,
    ])
    expect(telemetry).not.toContain(authorizationSecret)
    expect(telemetry).not.toContain(bodySecret)
})
