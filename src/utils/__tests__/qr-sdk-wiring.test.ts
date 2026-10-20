const mockInit = jest.fn()
const mockSentryInit = jest.fn()
const mockCaptureSignupAttribution = jest.fn()
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
    captureSignupAttribution: mockCaptureSignupAttribution,
    signupAttributionPosthogProperties: jest.fn(() => ({})),
}))

const payload = '/qr-pay?qrCode=private-payload&pixKey=private-key'
const savedEnv = { ...process.env }
afterEach(() => {
    for (const key of [
        'NODE_ENV',
        'NEXT_PUBLIC_CAPACITOR_BUILD',
        'NEXT_PUBLIC_SENTRY_DSN',
        'NEXT_PUBLIC_PERF_BARE',
        'NEXT_PUBLIC_POSTHOG_KEY',
        'NEXT_PUBLIC_VERCEL_ENV',
        'NEXT_PUBLIC_BASE_URL',
    ]) {
        if (savedEnv[key] === undefined) delete process.env[key]
        else Object.defineProperty(process.env, key, { value: savedEnv[key], writable: true, configurable: true })
    }
    window.history.replaceState({}, '', '/')
})

it.each([false, true])('installs QR privacy for PostHog pageviews, replay and native=%s', async (native) => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true })
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = String(native)
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@example.test/1'
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://peanut.me'
    delete process.env.NEXT_PUBLIC_PERF_BARE
    mockInit.mockClear()
    mockSentryInit.mockClear()
    mockCaptureSignupAttribution.mockClear()
    window.history.replaceState({}, '', payload)
    jest.isolateModules(() => require('../../../instrumentation-client'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const config = mockInit.mock.calls[0][1]
    // no VERCEL_ENV: the web build here is a local build, the native one is production
    expect(config.opt_out_capturing_by_default).toBe(!native)
    // `loaded` runs before the initial $pageview: platform must be registered there
    const register = jest.fn()
    config.loaded({ register })
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ platform: 'web', app_release: expect.any(String) }))
    expect(
        config.before_send({ event: '$pageview', properties: { $current_url: window.location.href } }).properties
            .$current_url
    ).toBe('[REDACTED QR DATA]')
    expect(config.session_recording.recordHeaders).toBe(false)
    expect(config.session_recording.recordBody).toBe(false)
    expect(config.session_recording.maskCapturedNetworkRequestFn({ name: payload })).toEqual({
        name: '[REDACTED QR DATA]',
    })
    expect(config.session_recording.maskAttributeFn('href', payload)).toBe('[REDACTED QR DATA]')
    expect(config.session_recording.maskAttributeFn('class', 'button purple')).toBe('button purple')
    window.history.replaceState({}, '', '/home')
    expect(
        config.before_send({ event: 'web_vital', properties: { navigationURL: payload } }).properties.navigationURL
    ).toBe('[REDACTED QR DATA]')
    if (native) {
        expect(mockCaptureSignupAttribution).not.toHaveBeenCalled()
        const sentry = mockSentryInit.mock.calls[0][0]
        expect(sentry.beforeSendTransaction({ transaction: payload }).transaction).toBe('[REDACTED QR DATA]')
        expect(sentry.beforeSend({ request: { url: payload } }).request.url).toBe('[REDACTED QR DATA]')
    } else {
        expect(mockCaptureSignupAttribution).toHaveBeenCalledWith({ includeDocumentReferrer: true })
    }
})

it('skips PostHog on a build with no key, and still starts native Sentry', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true })
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@example.test/1'
    process.env.NEXT_PUBLIC_POSTHOG_KEY = ''
    delete process.env.NEXT_PUBLIC_PERF_BARE
    mockInit.mockClear()
    mockSentryInit.mockClear()
    jest.isolateModules(() => require('../../../instrumentation-client'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockInit).not.toHaveBeenCalled()
    expect(mockSentryInit).toHaveBeenCalledTimes(1)
})

it.each([
    ['production', false],
    ['preview', true],
])('opts the %s web build out of capture, and keeps the key for flags', async (vercelEnv, optedOut) => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true })
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
    process.env.NEXT_PUBLIC_VERCEL_ENV = vercelEnv
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    delete process.env.NEXT_PUBLIC_PERF_BARE
    mockInit.mockClear()
    jest.isolateModules(() => require('../../../instrumentation-client'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockInit).toHaveBeenCalledWith(
        'phc_test',
        expect.objectContaining({ opt_out_capturing_by_default: optedOut })
    )
    const config = mockInit.mock.calls[0][1]
    expect(config.advanced_disable_flags).toBeUndefined()
    expect(config.advanced_disable_feature_flags).toBeUndefined()
})
