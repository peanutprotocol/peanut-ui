/*
 * Guards the wiring, not the scrub: ui#1756 stripped these secrets in March
 * 2026 and the next dev -> main release merge dropped it unnoticed. If a merge
 * loses any hook again, this fails.
 */
// A module, not a global script: its mocks would clash with qr-sdk-wiring.test.ts.
export {}

const mockInit = jest.fn()
const mockSentryInit = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        init: mockInit,
        startSessionRecording: jest.fn(),
        sentryIntegration: () => ({ name: 'mirror' }),
    },
}))
jest.mock('@sentry/nextjs', () => ({
    setTag: jest.fn(),
    init: mockSentryInit,
    makeBrowserOfflineTransport: jest.fn(),
    makeFetchTransport: jest.fn(),
    captureConsoleIntegration: jest.fn(() => ({ name: 'console' })),
}))
jest.mock('../defer-analytics', () => ({ whenIdle: jest.fn() }))
jest.mock('../web-vitals-shim', () => ({ startWebVitalsShim: jest.fn() }))
jest.mock('@/utils/signup-attribution', () => ({
    captureSignupAttribution: jest.fn(),
    signupAttributionPosthogProperties: jest.fn(() => ({})),
}))

const SECRET = 'fakeClaimSecret0123'
const CLAIM_PATH = '/claim?c=42161&v=v4.4&i=552'
const claimUrl = `https://peanut.me${CLAIM_PATH}#p=${SECRET}`
const setupRedirect = `/setup?redirect_uri=${encodeURIComponent(`${CLAIM_PATH}#p=${SECRET}`)}`
const savedEnv = { ...process.env }

afterEach(() => {
    for (const key of ['NODE_ENV', 'NEXT_PUBLIC_CAPACITOR_BUILD', 'NEXT_PUBLIC_SENTRY_DSN', 'NEXT_PUBLIC_PERF_BARE']) {
        if (savedEnv[key] === undefined) delete process.env[key]
        else Object.defineProperty(process.env, key, { value: savedEnv[key], writable: true, configurable: true })
    }
    window.history.replaceState({}, '', '/')
})

it.each([false, true])('keeps send-link secrets out of PostHog, replay and Sentry (native=%s)', async (native) => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true })
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = String(native)
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@example.test/1'
    delete process.env.NEXT_PUBLIC_PERF_BARE
    mockInit.mockClear()
    mockSentryInit.mockClear()
    jest.isolateModules(() => require('../../../instrumentation-client'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const config = mockInit.mock.calls[0][1]

    expect(config.disable_capture_url_hashes).toBe(true)
    const event = config.before_send({
        event: 'claim_link_viewed',
        properties: { $current_url: claimUrl, $referrer: setupRedirect },
        $set_once: { $initial_current_url: claimUrl },
    })
    expect(JSON.stringify(event)).not.toContain(SECRET)
    expect(event.properties.$current_url).toBe(`https://peanut.me${CLAIM_PATH}`)
    expect(config.session_recording.maskCapturedNetworkRequestFn({ name: claimUrl }).name).not.toContain(SECRET)
    expect(config.session_recording.maskCapturedNetworkRequestFn({ name: setupRedirect }).name).not.toContain(SECRET)
    expect(config.session_recording.maskAttributeFn('href', claimUrl)).not.toContain(SECRET)

    if (native) {
        const sentry = mockSentryInit.mock.calls[0][0]
        expect(JSON.stringify(sentry.beforeSend({ request: { url: claimUrl } }))).not.toContain(SECRET)
        expect(JSON.stringify(sentry.beforeSendTransaction({ request: { url: claimUrl } }))).not.toContain(SECRET)
    }
})
