/*
 * Runs the real `before_send` from instrumentation-client: the autocapture
 * sample rate from the flag payload drops only `$autocapture`, and every event
 * that is kept still goes through the send-link and QR redaction.
 */
// A module, not a global script: its mocks would clash with the other wiring tests.
export {}

const mockInit = jest.fn()
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
    init: jest.fn(),
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
const savedEnv = { ...process.env }

type Event = { event: string; properties: Record<string, unknown> }
type BeforeSend = (event: Event) => Event | null

const autocaptureClick = (): Event => ({
    event: '$autocapture',
    properties: {
        $event_type: 'click',
        $current_url: claimUrl,
        $el_text: 'Claim',
        $elements_chain: `a:attr__href="${CLAIM_PATH}#p=${SECRET}"nth-child="1"nth-of-type="1"text="Claim"`,
    },
})

/** Loads instrumentation-client and returns its PostHog config, with flags reporting `payload`. */
async function loadConfig() {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true })
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    delete process.env.NEXT_PUBLIC_PERF_BARE
    mockInit.mockClear()
    jest.isolateModules(() => require('../../../instrumentation-client'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const config = mockInit.mock.calls[0][1]

    let flagsLoaded: () => void = () => {}
    const getFeatureFlagResult = jest.fn()
    config.loaded({
        register: jest.fn(),
        onFeatureFlags: (callback: () => void) => {
            flagsLoaded = callback
            return () => {}
        },
        getFeatureFlagResult,
    })
    const setPayload = (payload: unknown) => {
        getFeatureFlagResult.mockReturnValue(payload === undefined ? undefined : { payload })
        flagsLoaded()
    }
    return { config, beforeSend: config.before_send as BeforeSend, setPayload }
}

afterEach(() => {
    for (const key of ['NODE_ENV', 'NEXT_PUBLIC_CAPACITOR_BUILD', 'NEXT_PUBLIC_PERF_BARE', 'NEXT_PUBLIC_POSTHOG_KEY']) {
        if (savedEnv[key] === undefined) delete process.env[key]
        else Object.defineProperty(process.env, key, { value: savedEnv[key], writable: true, configurable: true })
    }
    jest.restoreAllMocks()
})

it('captures clicks on buttons and links only, with element text and attributes masked', async () => {
    const { config } = await loadConfig()
    expect(config.autocapture).toEqual({ dom_event_allowlist: ['click'], element_allowlist: ['button', 'a'] })
    expect(config.mask_all_text).toBe(true)
    expect(config.mask_all_element_attributes).toBe(true)
})

it('keeps every $autocapture event, redacted, when the flag has no payload', async () => {
    const { beforeSend, setPayload } = await loadConfig()
    setPayload(undefined)
    jest.spyOn(Math, 'random').mockReturnValue(0.999)
    const kept = beforeSend(autocaptureClick())
    expect(kept?.event).toBe('$autocapture')
    expect(JSON.stringify(kept)).not.toContain(SECRET)
    expect(kept?.properties.$current_url).toBe(`https://peanut.me${CLAIM_PATH}`)
    expect(kept?.properties.$el_text).toBe('Claim')
})

it('cuts link targets in $autocapture to a path or a host', async () => {
    const { beforeSend } = await loadConfig()
    const kept = beforeSend({
        event: '$autocapture',
        properties: {
            $elements_chain: 'a:attr__href="https://storage.example.com/uploads/receipt-alice.pdf?sig=s3cr3tSig"',
            $external_click_url: 'https://storage.example.com/uploads/receipt-alice.pdf?sig=s3cr3tSig',
        },
    })
    expect(kept?.properties).toEqual({
        $elements_chain: 'a:attr__href="https://storage.example.com"',
        $external_click_url: 'https://storage.example.com',
    })
})

it('keeps every $autocapture event before flags load', async () => {
    const { beforeSend } = await loadConfig()
    jest.spyOn(Math, 'random').mockReturnValue(0.999)
    expect(beforeSend(autocaptureClick())?.event).toBe('$autocapture')
})

it('drops the sampled-out share of $autocapture and redacts the share it keeps', async () => {
    const { beforeSend, setPayload } = await loadConfig()
    setPayload(0.4)
    const random = jest.spyOn(Math, 'random')

    random.mockReturnValue(0.39)
    const kept = beforeSend(autocaptureClick())
    expect(kept?.event).toBe('$autocapture')
    expect(JSON.stringify(kept)).not.toContain(SECRET)

    random.mockReturnValue(0.4)
    expect(beforeSend(autocaptureClick())).toBeNull()
})

it('never samples named events, $pageview or $exception, even at rate 0', async () => {
    const { beforeSend, setPayload } = await loadConfig()
    setPayload(0)
    jest.spyOn(Math, 'random').mockReturnValue(0)

    expect(beforeSend(autocaptureClick())).toBeNull()

    const named = { event: 'card_gate_step_viewed', properties: { step: 'funding', funded: false } }
    expect(beforeSend({ ...named, properties: { ...named.properties } })).toEqual(named)

    const pageview = beforeSend({ event: '$pageview', properties: { $current_url: claimUrl } })
    expect(pageview?.properties.$current_url).toBe(`https://peanut.me${CLAIM_PATH}`)

    const exception = beforeSend({ event: '$exception', properties: { $exception_message: `Bad link ${claimUrl}` } })
    expect(exception?.event).toBe('$exception')
    expect(JSON.stringify(exception)).not.toContain(SECRET)
})
