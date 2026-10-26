import { attachSignupGeo, resumeSignupGeo, signupGeoPayload } from '../signup-geo'
import { EMPTY_SETUP_COUNTRY_SIGNALS } from '@/features/setup/country-signals'
const mockApiFetch = jest.fn()
let listener: (() => void) | undefined
let snapshot = { ...EMPTY_SETUP_COUNTRY_SIGNALS }
const mockUnsubscribe = jest.fn()
const mockPreferences = { get: jest.fn(), set: jest.fn(), remove: jest.fn() }
let mockNative = false
let mockEpoch = 0
jest.mock('@capacitor/app', () => ({ App: { addListener: jest.fn().mockResolvedValue({ remove: jest.fn() }) } }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/auth-token', () => ({ getClearEpoch: () => mockEpoch }))
jest.mock('@/utils/capacitor', () => ({ isNativeBridge: () => mockNative }))
jest.mock('@capacitor/preferences', () => ({ Preferences: mockPreferences }))
jest.mock('@/features/setup/country-signals', () => ({
    EMPTY_SETUP_COUNTRY_SIGNALS: { collectedAt: null },
    currentSetupCountrySignals: () => snapshot,
    startSetupCountrySignals: () => Promise.resolve(),
    subscribeSetupCountrySignals: (callback: () => void) => {
        listener = callback
        return mockUnsubscribe
    },
}))
let stop: (() => void) | undefined
beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    jest.clearAllMocks()
    localStorage.clear()
    mockNative = false
    mockEpoch = 0
    snapshot = { ...EMPTY_SETUP_COUNTRY_SIGNALS }
    mockApiFetch.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ accepted: true }) })
})
afterEach(() => {
    stop?.()
    jest.clearAllTimers()
    jest.useRealTimers()
})
const flush = async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve()
}
const pending = (userId: string) => localStorage.getItem(`peanut.signup-geo.v1.${userId}`)
const begin = async () => {
    stop = resumeSignupGeo('user-a')
    await attachSignupGeo('user-a')
    await flush()
}
test('missing observations are not invented from declared residence', () => {
    expect(signupGeoPayload(snapshot)).toBeNull()
})
test('delivers late store signal bound to the signup user', async () => {
    snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', vercelIpCountry: 'PT' }
    await begin()
    snapshot = {
        ...snapshot,
        storeCountry: { countryCode: 'BR', source: 'google-play' },
        storeCountryCollectedAt: '2026-10-06T12:00:02Z',
    }
    listener?.()
    await flush()
    expect(mockApiFetch).toHaveBeenLastCalledWith(
        '/users/me/geo',
        expect.objectContaining({
            body: JSON.stringify({ expectedUserId: 'user-a', signup: signupGeoPayload(snapshot) }),
            redactTelemetry: true,
        })
    )
    jest.advanceTimersByTime(10_000)
    await flush()
    expect(pending('user-a')).toBeNull()
})
test('network failure retries independently and recovers the persisted snapshot after restart', async () => {
    snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', vercelIpCountry: 'PT' }
    mockApiFetch.mockRejectedValue(new Error('offline'))
    await begin()
    expect(pending('user-a')).toContain('PT')
    jest.advanceTimersByTime(1000)
    await flush()
    expect(mockApiFetch.mock.calls.length).toBeGreaterThan(1)
    stop?.()
    snapshot = { ...EMPTY_SETUP_COUNTRY_SIGNALS }
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ accepted: true }) })
    stop = resumeSignupGeo('user-a')
    await flush()
    expect(JSON.parse(mockApiFetch.mock.calls.at(-1)![1].body).signup.vercelIp.country).toBe('PT')
    jest.advanceTimersByTime(10_000)
    await flush()
    expect(pending('user-a')).toBeNull()
})
test('HTTP failures retain the queue and an online wake retries it', async () => {
    snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', vercelIpCountry: 'PT' }
    mockApiFetch.mockResolvedValue({ ok: false, status: 503 })
    await begin()
    expect(pending('user-a')).toContain('PT')
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ accepted: true }) })
    window.dispatchEvent(new Event('online'))
    await flush()
    jest.advanceTimersByTime(10_000)
    await flush()
    expect(pending('user-a')).toBeNull()
})
test('switching accounts aborts the old request and never sends its queued data to the new account', async () => {
    snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', vercelIpCountry: 'PT' }
    mockApiFetch.mockRejectedValue(new Error('offline'))
    await begin()
    const calls = mockApiFetch.mock.calls.length
    stop = resumeSignupGeo('user-b')
    await flush()
    listener?.()
    jest.advanceTimersByTime(60000)
    await flush()
    expect(mockApiFetch).toHaveBeenCalledTimes(calls)
    expect(mockApiFetch.mock.calls[0][1].signal.aborted).toBe(true)
    expect(pending('user-a')).toContain('PT')
})
test('a delayed acknowledgement cannot erase a late locale result', async () => {
    snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', browserLanguages: ['en'], deviceTimezone: 'UTC' }
    let ack!: (value: unknown) => void
    mockApiFetch.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                ack = resolve
            })
    )
    await begin()
    snapshot = { ...snapshot, deviceLanguage: 'pt-pt' }
    listener?.()
    await flush()
    ack({ ok: true, status: 200, json: async () => ({ accepted: true }) })
    await flush()
    expect(pending('user-a')).toContain('pt-pt')
    jest.advanceTimersByTime(1000)
    await flush()
    expect(JSON.parse(mockApiFetch.mock.calls.at(-1)![1].body).signup.device.locale).toBe('pt-pt')
    jest.advanceTimersByTime(10_000)
    await flush()
    expect(pending('user-a')).toBeNull()
})
test.each([401, 403, 409])(
    'session failure %s stops delivery and retains the original account queue',
    async (status) => {
        snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', vercelIpCountry: 'PT' }
        mockApiFetch.mockResolvedValue({ ok: false, status })
        await begin()
        const calls = mockApiFetch.mock.calls.length
        listener?.()
        jest.advanceTimersByTime(60000)
        await flush()
        expect(mockApiFetch).toHaveBeenCalledTimes(calls)
        expect(pending('user-a')).toContain('PT')
    }
)
test('a restart after early acknowledgement resumes collecting a missing locale', async () => {
    snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', browserLanguages: ['en'], deviceTimezone: 'UTC' }
    await begin()
    expect(JSON.parse(pending('user-a')!).delivered).toBe(true)
    stop?.()
    snapshot = { ...snapshot, deviceLanguage: 'pt-pt' }
    stop = resumeSignupGeo('user-a')
    await flush()
    expect(JSON.parse(mockApiFetch.mock.calls.at(-1)![1].body).signup.device.locale).toBe('pt-pt')
    jest.advanceTimersByTime(10_000)
    await flush()
    expect(pending('user-a')).toBeNull()
})
test('expired observations are discarded without sending', async () => {
    localStorage.setItem(
        'peanut.signup-geo.v1.user-a',
        JSON.stringify({
            userId: 'user-a',
            expiresAt: Date.now() - 1,
            signup: { vercelIp: { country: 'PT', observedAt: '2026-10-05T11:00:00Z' } },
        })
    )
    stop = resumeSignupGeo('user-a')
    await flush()
    expect(mockApiFetch).not.toHaveBeenCalled()
    jest.advanceTimersByTime(10_000)
    await flush()
    expect(pending('user-a')).toBeNull()
})
test('native recovery reads and acknowledges Preferences when WebView storage is empty', async () => {
    mockNative = true
    mockPreferences.get.mockResolvedValue({
        value: JSON.stringify({
            userId: 'user-a',
            expiresAt: Date.now() + 10000,
            signup: { vercelIp: { country: 'PT', observedAt: new Date().toISOString() } },
        }),
    })
    stop = resumeSignupGeo('user-a')
    await flush()
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    expect(mockPreferences.remove).toHaveBeenCalledWith({ key: 'peanut.signup-geo.v1.user-a' })
})
