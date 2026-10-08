import { isStoreUpdateAvailable, STORE_UPDATE_TIMEOUT_MS } from '../store-update'

const mockGetInfo = jest.fn()
const mockCountry = jest.fn()
const mockDevice = jest.fn()
const platform = { native: true, ios: false }
jest.mock('@capgo/capacitor-updater', () => ({
    CapacitorUpdater: { getAppUpdateInfo: (...args: unknown[]) => mockGetInfo(...args) },
    AppUpdateAvailability: { UPDATE_AVAILABLE: 2 },
}))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => platform.native,
    isIOSNative: () => platform.ios,
}))
jest.mock('@/utils/store-country', () => ({ getStoreCountry: () => mockCountry() }))
jest.mock('@capacitor/device', () => ({ Device: { getInfo: () => mockDevice() } }))

const android = { updateAvailability: 2, currentVersionCode: '23406685', availableVersionCode: '24250231' }
const ios = {
    updateAvailability: 2,
    currentVersionName: '1.7.0',
    availableVersionName: '1.9.0',
    minimumOsVersion: '16.4',
}

beforeEach(() => {
    platform.native = true
    platform.ios = false
    mockGetInfo.mockReset().mockResolvedValue(android)
    mockCountry.mockReset().mockResolvedValue({ countryCode: 'AR', source: 'app-store' })
    mockDevice.mockReset().mockResolvedValue({ osVersion: '18.1' })
})
afterEach(() => jest.useRealTimers())

it('uses Play eligibility and native build codes, including a same-marketing-version replacement', async () => {
    mockGetInfo.mockResolvedValue({ ...android, currentVersionName: '1.7.0', availableVersionName: '24250231' })
    await expect(isStoreUpdateAvailable()).resolves.toBe(true)
    expect(mockGetInfo).toHaveBeenCalledWith()
    expect(mockCountry).not.toHaveBeenCalled()
})

it.each([0, 1, 3, undefined])(
    'hides the Android offer for availability %s even with a newer code',
    async (availability) => {
        mockGetInfo.mockResolvedValue({ ...android, updateAvailability: availability })
        await expect(isStoreUpdateAvailable()).resolves.toBe(false)
    }
)

it.each(['23406685', '23406684', '', '1.9.0', 'broken', undefined, '99999999999999999999'])(
    'hides a missing, invalid or non-newer Play code %s',
    async (code) => {
        mockGetInfo.mockResolvedValue({ ...android, availableVersionCode: code })
        await expect(isStoreUpdateAvailable()).resolves.toBe(false)
    }
)

it.each(['offline', 'not implemented', 'app not owned by this account'])(
    'hides Android failures: %s',
    async (error) => {
        mockGetInfo.mockRejectedValue(new Error(error))
        await expect(isStoreUpdateAvailable()).resolves.toBe(false)
    }
)

it.each(['0', 'unknown', undefined])(
    'hides the offer when the installed Android build is unreadable: %s',
    async (code) => {
        mockGetInfo.mockResolvedValue({ ...android, currentVersionCode: code })
        await expect(isStoreUpdateAvailable()).resolves.toBe(false)
    }
)

it('uses the current iOS storefront and requires a newer public version and supported OS', async () => {
    platform.ios = true
    mockGetInfo.mockResolvedValue(ios)
    await expect(isStoreUpdateAvailable()).resolves.toBe(true)
    expect(mockGetInfo).toHaveBeenCalledWith({ country: 'AR' })
})

it('hides iOS offers on older binaries without a storefront bridge rather than defaulting to US', async () => {
    platform.ios = true
    mockCountry.mockResolvedValue(null)
    await expect(isStoreUpdateAvailable()).resolves.toBe(false)
    expect(mockGetInfo).not.toHaveBeenCalled()
})

it.each([
    { ...ios, updateAvailability: 1 },
    { ...ios, availableVersionName: '1.7.0' },
    { ...ios, availableVersionName: '1.6.0' },
    { ...ios, availableVersionName: 'broken' },
    { ...ios, availableVersionName: undefined },
    { ...ios, minimumOsVersion: '26.0' },
    { ...ios, minimumOsVersion: undefined },
])('hides an unavailable/uninstallable iOS response %p', async (info) => {
    platform.ios = true
    mockGetInfo.mockResolvedValue(info)
    await expect(isStoreUpdateAvailable()).resolves.toBe(false)
})

it('compares iOS release versions numerically', async () => {
    platform.ios = true
    mockGetInfo.mockResolvedValue({ ...ios, currentVersionName: '1.9.0', availableVersionName: '1.10.0' })
    await expect(isStoreUpdateAvailable()).resolves.toBe(true)
})

it('does no native work on web', async () => {
    platform.native = false
    await expect(isStoreUpdateAvailable()).resolves.toBe(false)
    expect(mockGetInfo).not.toHaveBeenCalled()
})

it('bounds a hung store check, ignores a late positive answer and clears its timer', async () => {
    jest.useFakeTimers()
    let finish!: (info: typeof android) => void
    mockGetInfo.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const result = isStoreUpdateAvailable()
    await jest.advanceTimersByTimeAsync(STORE_UPDATE_TIMEOUT_MS)
    await expect(result).resolves.toBe(false)
    finish(android)
    await expect(result).resolves.toBe(false)
    expect(jest.getTimerCount()).toBe(0)
})

it('clears the timeout after a successful store check', async () => {
    jest.useFakeTimers()
    await expect(isStoreUpdateAvailable()).resolves.toBe(true)
    expect(jest.getTimerCount()).toBe(0)
})
