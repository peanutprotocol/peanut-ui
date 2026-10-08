import { isAndroidNative, isIOSNative, isNativeBridge } from '../capacitor'

const implementation: Record<string, unknown> = {}
jest.mock('@capacitor/core', () => ({
    registerPlugin: jest.fn(() =>
        jest.requireActual('../__mocks__/capacitor-plugin-proxy').createPluginProxy(implementation, 'StoreCountry')
    ),
}))
jest.mock('../capacitor', () => ({
    isIOSNative: jest.fn(() => true),
    isAndroidNative: jest.fn(() => false),
    isNativeBridge: jest.fn(() => true),
}))

import { getStoreCountry, STORE_COUNTRY_TIMEOUT_MS } from '../store-country'

beforeEach(() => {
    jest.clearAllMocks()
    for (const key of Object.keys(implementation)) delete implementation[key]
    jest.mocked(isIOSNative).mockReturnValue(true)
    jest.mocked(isAndroidNative).mockReturnValue(false)
    jest.mocked(isNativeBridge).mockReturnValue(true)
})
afterEach(() => jest.useRealTimers())

it('normalizes StoreKit alpha-3 to alpha-2 without losing the source', async () => {
    implementation.getCurrent = jest.fn().mockResolvedValue({ countryCode: 'USA' })
    await expect(getStoreCountry()).resolves.toEqual({ countryCode: 'US', source: 'app-store' })
})

it('uses Play country, rather than device/IP country, on Android', async () => {
    jest.mocked(isIOSNative).mockReturnValue(false)
    jest.mocked(isAndroidNative).mockReturnValue(true)
    implementation.getCurrent = jest.fn().mockResolvedValue({ countryCode: 'br' })
    await expect(getStoreCountry()).resolves.toEqual({ countryCode: 'BR', source: 'google-play' })
})

it('does not reuse a previous successful read when the store changes or becomes unavailable', async () => {
    const read = jest
        .fn()
        .mockResolvedValueOnce({ countryCode: 'ARG' })
        .mockResolvedValueOnce({ countryCode: 'PRT' })
        .mockResolvedValueOnce({ countryCode: null })
    implementation.getCurrent = read
    await expect(getStoreCountry()).resolves.toEqual({ countryCode: 'AR', source: 'app-store' })
    await expect(getStoreCountry()).resolves.toEqual({ countryCode: 'PT', source: 'app-store' })
    await expect(getStoreCountry()).resolves.toBeNull()
    expect(read).toHaveBeenCalledTimes(3)
})

it.each([null, undefined, '', 'ZZ', 'ZZZ', '123', ' USA ', 'United States', 123, {}])(
    'treats invalid native country %p as unknown',
    async (countryCode) => {
        implementation.getCurrent = jest.fn().mockResolvedValue({ countryCode })
        await expect(getStoreCountry()).resolves.toBeNull()
    }
)

it('treats a malformed response as unknown', async () => {
    implementation.getCurrent = jest.fn().mockResolvedValue(undefined)
    await expect(getStoreCountry()).resolves.toBeNull()
})

it('returns unknown on old binaries with no native plugin', async () => {
    await expect(getStoreCountry()).resolves.toBeNull()
})

it('returns unknown on native errors', async () => {
    implementation.getCurrent = jest.fn().mockRejectedValue(new Error('store service unavailable'))
    await expect(getStoreCountry()).resolves.toBeNull()
})

it.each(['web', 'native-looking browser'])('does not call the store on %s', async (platform) => {
    const read = jest.fn()
    implementation.getCurrent = read
    if (platform === 'web') jest.mocked(isIOSNative).mockReturnValue(false)
    else jest.mocked(isNativeBridge).mockReturnValue(false)
    await expect(getStoreCountry()).resolves.toBeNull()
    expect(read).not.toHaveBeenCalled()
})

it('bounds a hung native bridge and ignores its late result', async () => {
    jest.useFakeTimers()
    let finish!: (value: { countryCode: string }) => void
    implementation.getCurrent = jest.fn(
        () =>
            new Promise((resolve) => {
                finish = resolve
            })
    )
    const result = getStoreCountry()
    jest.advanceTimersByTime(STORE_COUNTRY_TIMEOUT_MS)
    await expect(result).resolves.toBeNull()
    finish({ countryCode: 'USA' })
    await expect(result).resolves.toBeNull()
    expect(jest.getTimerCount()).toBe(0)
})

it('clears the watchdog after a successful response', async () => {
    jest.useFakeTimers()
    implementation.getCurrent = jest.fn().mockResolvedValue({ countryCode: 'GBR' })
    await expect(getStoreCountry()).resolves.toEqual({ countryCode: 'GB', source: 'app-store' })
    expect(jest.getTimerCount()).toBe(0)
})
