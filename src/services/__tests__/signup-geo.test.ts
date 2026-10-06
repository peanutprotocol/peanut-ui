import { attachSignupGeo, signupGeoPayload } from '../signup-geo'
import { EMPTY_SETUP_COUNTRY_SIGNALS } from '@/features/setup/country-signals'
const mockApiFetch = jest.fn()
let listener: (() => void) | undefined
let snapshot = { ...EMPTY_SETUP_COUNTRY_SIGNALS }
const mockUnsubscribe = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/features/setup/country-signals', () => ({
    EMPTY_SETUP_COUNTRY_SIGNALS: { collectedAt: null },
    currentSetupCountrySignals: () => snapshot,
    startSetupCountrySignals: () => Promise.resolve(),
    subscribeSetupCountrySignals: (callback: () => void) => {
        listener = callback
        return mockUnsubscribe
    },
}))
beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    snapshot = { ...EMPTY_SETUP_COUNTRY_SIGNALS }
    mockApiFetch.mockResolvedValue({ ok: true, status: 200 })
})
afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
})
const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve()
}
test('missing observations are not invented from declared residence', () => {
    expect(signupGeoPayload(snapshot)).toBeNull()
})
test('delivers late store signal bound to the signup user', async () => {
    snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', vercelIpCountry: 'PT' }
    attachSignupGeo('user-a')
    await flush()
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
})
test('switching session stops observation delivery', async () => {
    snapshot = { ...snapshot, collectedAt: '2026-10-06T12:00:00Z', vercelIpCountry: 'PT' }
    mockApiFetch.mockResolvedValue({ status: 409 })
    attachSignupGeo('user-a')
    await flush()
    listener?.()
    await flush()
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
})
