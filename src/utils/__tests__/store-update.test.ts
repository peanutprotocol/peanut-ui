jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { compareStoreVersions, getStoreUpdateOffer, STORE_UPDATE_TIMEOUT_MS } from '../store-update'

const isStoreUpdateAvailable = async () => Boolean(await getStoreUpdateOffer())

const mockGetInfo = jest.fn()
const mockCountry = jest.fn()
const mockDevice = jest.fn()
const platform = { native: true, ios: false }
jest.mock('@capgo/capacitor-updater', () => ({
    CapacitorUpdater: { getAppUpdateInfo: (...args: unknown[]) => mockGetInfo(...args) },
    AppUpdateAvailability: { UPDATE_AVAILABLE: 2 },
}))
jest.mock('@/utils/capacitor', () => ({
    isAndroidNativeBridge: () => platform.native && !platform.ios,
    isIOSNativeBridge: () => platform.native && platform.ios,
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

it('returns the confirmed installed and offered Play codes', async () => {
    await expect(getStoreUpdateOffer()).resolves.toEqual({
        platform: 'android',
        installedVersion: android.currentVersionCode,
        availableVersion: android.availableVersionCode,
    })
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

it('agrees with base-1000 ordering for 512 seeded iOS version pairs', () => {
    let seed = 0x27c005
    const nextPart = () => {
        seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
        return seed % 1_000
    }
    const draw = () => [nextPart(), nextPart(), nextPart()]
    const rank = (parts: number[]) => parts.reduce((total, part) => total * 1_000 + part, 0)

    for (let i = 0; i < 512; i++) {
        const left = draw()
        const right = draw()
        expect(Math.sign(compareStoreVersions('ios', left.join('.'), right.join('.')) ?? NaN)).toBe(
            Math.sign(rank(left) - rank(right))
        )
    }
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
