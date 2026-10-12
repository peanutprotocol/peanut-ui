import { act, renderHook, waitFor } from '@testing-library/react'

const mockRegister = jest.fn()
const mockCapture = jest.fn()
const mockSetPersonProperties = jest.fn()
const mockRawDeviceTag = jest.fn()
const mockApiBaseUrl = jest.fn()
let mockIpCountry: string | null = null

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        register: (...args: unknown[]) => mockRegister(...args),
        capture: (...args: unknown[]) => mockCapture(...args),
        setPersonProperties: (...args: unknown[]) => mockSetPersonProperties(...args),
        _isIdentified: () => true,
    },
}))
jest.mock('@/i18n/app/locale-store', () => ({ rawDeviceTag: () => mockRawDeviceTag() }))
jest.mock('@/utils/capacitor', () => ({ getApiBaseUrl: () => mockApiBaseUrl() }))
jest.mock('@/hooks/useGeoLocation', () => ({ useGeoLocation: () => ({ countryCode: mockIpCountry }) }))

type Store = typeof import('../country-signals')
let store: Store
const originalFetch = global.fetch

beforeEach(() => {
    jest.clearAllMocks()
    mockIpCountry = null
    mockApiBaseUrl.mockReturnValue('')
    mockRawDeviceTag.mockResolvedValue('pt-BR')
    Object.defineProperty(navigator, 'languages', { value: ['pt-BR', 'en-US'], configurable: true })
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ country: 'AR' }) })) as unknown as typeof fetch
    jest.isolateModules(() => {
        store = require('../country-signals')
    })
})

afterEach(() => {
    global.fetch = originalFetch
    jest.useRealTimers()
})

it('captures independent country, language and timezone signals without app_locale', async () => {
    store.recordSetupIpCountry(' br\n')
    await store.startSetupCountrySignals()
    const properties = store.setupCountrySignalProperties()
    expect(properties).toEqual(
        expect.objectContaining({
            signup_vercel_ip_country: 'AR',
            signup_ip_country: 'BR',
            signup_device_language: 'pt-br',
            signup_browser_languages: ['pt-br', 'en-us'],
            signup_device_timezone: expect.any(String),
            signup_country_suggestion: 'AR',
            signup_country_suggestion_source: 'vercel_ip_country',
            signup_country_signals_collected_at: expect.any(String),
        })
    )
    expect(properties).not.toHaveProperty('app_locale')
    expect(mockRegister).toHaveBeenLastCalledWith(properties)
    expect(mockSetPersonProperties).toHaveBeenLastCalledWith(properties)
    expect(mockCapture).toHaveBeenLastCalledWith('signup_country_signals_captured', properties)
})

it('deduplicates the edge and device lookup across setup screens', async () => {
    const first = store.startSetupCountrySignals()
    expect(store.startSetupCountrySignals()).toBe(first)
    await first
    await store.startSetupCountrySignals()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mockRawDeviceTag).toHaveBeenCalledTimes(1)
})

it('waits for edge before using a faster IP result, then falls back when edge is absent', async () => {
    let finish!: (response: unknown) => void
    global.fetch = jest.fn(
        () =>
            new Promise((resolve) => {
                finish = resolve
            })
    ) as unknown as typeof fetch
    store.recordSetupIpCountry('BR')
    const pending = store.startSetupCountrySignals()
    expect(store.setupCountrySuggestion(store.currentSetupCountrySignals())).toBeNull()
    finish({ ok: true, json: async () => ({ country: null }) })
    await pending
    expect(store.setupCountrySuggestion(store.currentSetupCountrySignals())).toEqual({ country: 'BR', source: 'ipapi' })
})

it('falls back after a bounded edge timeout even if fetch ignores abort', async () => {
    jest.useFakeTimers()
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch
    store.recordSetupIpCountry('BR')
    const pending = store.startSetupCountrySignals()
    await jest.advanceTimersByTimeAsync(store.SETUP_EDGE_COUNTRY_TIMEOUT_MS)
    await pending
    expect(store.setupCountrySuggestion(store.currentSetupCountrySignals())).toEqual({ country: 'BR', source: 'ipapi' })
})

it.each([null, 'XX', 'ZZ', 'Brazil', '<html>challenge</html>'])('ignores invalid edge country %s', async (country) => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ country }) })) as unknown as typeof fetch
    store.recordSetupIpCountry('DE')
    await store.startSetupCountrySignals()
    expect(store.setupCountrySuggestion(store.currentSetupCountrySignals())).toEqual({ country: 'DE', source: 'ipapi' })
})

it('keeps collection and fallback usable when the endpoint and analytics fail', async () => {
    global.fetch = jest.fn(async () => {
        throw new Error('offline')
    })
    mockRegister.mockImplementationOnce(() => {
        throw new Error('analytics blocked')
    })
    store.recordSetupIpCountry('PT')
    await store.startSetupCountrySignals()
    expect(store.currentSetupCountrySignals()).toEqual(
        expect.objectContaining({
            deviceLanguage: 'pt-br',
            edgeSettled: true,
            ipCountry: 'PT',
        })
    )
})

it('uses the deployed web endpoint from a native static export without credentials', async () => {
    mockApiBaseUrl.mockReturnValue('https://peanut.me')
    await store.startSetupCountrySignals()
    expect(fetch).toHaveBeenCalledWith(
        'https://peanut.me/api/geo-country',
        expect.objectContaining({
            credentials: 'omit',
            cache: 'no-store',
            signal: expect.any(AbortSignal),
        })
    )
})

it('falls back to an offered IP country when the edge country is not in the picker', async () => {
    store.recordSetupIpCountry('DE')
    await store.startSetupCountrySignals()
    expect(store.setupCountrySuggestion(store.currentSetupCountrySignals(), ['DE'])).toEqual({
        country: 'DE',
        source: 'ipapi',
    })
})

it('shares updates with the mounted hook without waiting for another screen', async () => {
    // Use the same module registry for React and the hook; isolate only the store.
    jest.doMock('../country-signals', () => store)
    const { useSetupCountrySignals } =
        require('../useSetupCountrySignals') as typeof import('../useSetupCountrySignals')
    const { result, rerender } = renderHook(() => useSetupCountrySignals())
    await waitFor(() => expect(result.current.edgeSettled).toBe(true))
    expect(result.current.vercelIpCountry).toBe('AR')
    mockIpCountry = 'BR'
    act(() => {
        rerender()
    })
    expect(result.current.ipCountry).toBe('BR')
    jest.dontMock('../country-signals')
})
