/**
 * Peanut's capture, store encoding, native restore, persistence and attachment
 * run together. OS plugins, native Preferences and the HTTP boundary are fakes;
 * this verifies the JS handoff contract, not a device install or server write.
 */
import { attachSignupAttribution } from '../signup-attribution'
import {
    buildDeferredPayload,
    iosHandoffString,
    playStoreUrlWithReferrer,
    restoreDeferredContext,
} from '@/utils/deferred-link'
import {
    captureSignupAttribution,
    ensureSignupAttributionForRegistration,
    hasPendingSignupAttribution,
    markSignupAttributionPending,
    readSignupAttributionAsync,
} from '@/utils/signup-attribution'

const mockNativeStorage = new Map<string, string>()
const mockGetReferrer = jest.fn()
const mockHasStrings = jest.fn()
const mockHasWebUrl = jest.fn()
const mockClipboardRead = jest.fn()
const mockClipboardWrite = jest.fn()
const mockPreferencesSet = jest.fn()
const mockApiFetch = jest.fn()
const mockOptedOut = jest.fn()

jest.mock('@capacitor/core', () => ({
    registerPlugin: (name: string) =>
        name === 'InstallReferrer'
            ? { getReferrer: () => mockGetReferrer() }
            : {
                  hasStrings: () => mockHasStrings(),
                  hasProbableWebUrl: () => mockHasWebUrl(),
              },
}))
jest.mock('@capacitor/clipboard', () => ({
    Clipboard: { read: () => mockClipboardRead(), write: (value: unknown) => mockClipboardWrite(value) },
}))
jest.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: async ({ key }: { key: string }) => ({ value: mockNativeStorage.get(key) ?? null }),
        set: (entry: { key: string; value: string }) => mockPreferencesSet(entry),
        remove: async ({ key }: { key: string }) => {
            mockNativeStorage.delete(key)
        },
    },
}))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), register: jest.fn(), has_opted_out_capturing: () => mockOptedOut() },
}))

const originalEnv = { ...process.env }
const originalUserAgent = navigator.userAgent

function clearCookies() {
    for (const cookie of document.cookie.split(';')) {
        document.cookie = `${cookie.trim().split('=')[0]}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
}

function enterNative(platform: 'ios' | 'android') {
    clearCookies()
    localStorage.clear()
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
    Object.defineProperty(window, 'Capacitor', {
        configurable: true,
        value: { isNativePlatform: () => true, getPlatform: () => platform },
    })
    Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: platform === 'ios' ? 'iPhone' : 'Android',
    })
    Object.defineProperty(document, 'referrer', { configurable: true, value: '' })
    window.history.replaceState({}, '', '/setup')
}

function handoff(platform: 'ios' | 'android') {
    window.history.replaceState({}, '', '/en/argentina?utm_source=guide&utm_campaign=fall')
    const web = captureSignupAttribution()!
    const payload = buildDeferredPayload('/home', undefined, platform)
    const raw =
        platform === 'ios'
            ? iosHandoffString(payload)
            : new URL(playStoreUrlWithReferrer(payload)).searchParams.get('referrer')!
    enterNative(platform)
    mockGetReferrer.mockResolvedValue({ referrer: raw })
    mockClipboardRead.mockResolvedValue({ value: raw })
    return web
}

beforeEach(() => {
    jest.clearAllMocks()
    mockNativeStorage.clear()
    localStorage.clear()
    clearCookies()
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
    Object.defineProperty(window, 'Capacitor', { configurable: true, value: undefined })
    mockHasStrings.mockResolvedValue({ value: true })
    mockHasWebUrl.mockResolvedValue({ value: true })
    mockClipboardWrite.mockResolvedValue(undefined)
    mockPreferencesSet.mockImplementation(async ({ key, value }: { key: string; value: string }) => {
        mockNativeStorage.set(key, value)
    })
    mockOptedOut.mockReturnValue(false)
})

afterEach(() => {
    delete (document as unknown as Record<string, unknown>).cookie
    process.env = { ...originalEnv }
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent })
    Object.defineProperty(window, 'Capacitor', { configurable: true, value: undefined })
})

it.each(['android', 'ios'] as const)(
    '%s: a captured campaign survives native restore, cookie loss, restart and a failed attachment',
    async (platform) => {
        const web = handoff(platform)
        await expect(restoreDeferredContext()).resolves.toEqual({ dest: '/home', locale: 'en' })
        const registration = await ensureSignupAttributionForRegistration()
        expect(registration).toMatchObject({
            journeyId: web.journeyId,
            captureMethod: 'deferred_link',
            firstTouch: web.firstTouch,
            firstContentTouch: web.firstContentTouch,
        })
        await markSignupAttributionPending('registrant-a')
        clearCookies()
        localStorage.clear()
        mockApiFetch.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue({ ok: true, status: 200 })

        await jest.isolateModulesAsync(async () => {
            const { attachSignupAttribution: attachAfterRestart } = await import('../signup-attribution')
            await expect(attachAfterRestart('other-account')).resolves.toBe(false)
            expect(mockApiFetch).not.toHaveBeenCalled()
            await expect(attachAfterRestart('registrant-a')).rejects.toThrow('503')
        })
        expect(await hasPendingSignupAttribution('registrant-a')).toBe(true)
        await jest.isolateModulesAsync(async () => {
            const { attachSignupAttribution: attachAfterRetry } = await import('../signup-attribution')
            await expect(
                Promise.all([attachAfterRetry('registrant-a'), attachAfterRetry('registrant-a')])
            ).resolves.toEqual([true, true])
            await expect(attachAfterRetry('registrant-a')).resolves.toBe(false)
        })
        expect(mockApiFetch).toHaveBeenCalledTimes(2)
        const [route, options] = mockApiFetch.mock.calls[1]
        expect(route).toBe('/users/me/signup-attribution')
        expect(options.redactTelemetry).toBe(true)
        expect(JSON.parse(JSON.parse(options.body).attribution)).toEqual(registration)
        expect(await hasPendingSignupAttribution('registrant-a')).toBe(false)
        expect(await readSignupAttributionAsync()).toEqual(registration)
        if (platform === 'ios') expect(mockClipboardWrite).toHaveBeenCalledWith({ string: ' ' })
    }
)

it.each(['denied', 'empty', 'missing-plugin'] as const)(
    'iOS %s handoff leaves the signup source unknown',
    async (failure) => {
        handoff('ios')
        if (failure === 'denied') mockClipboardRead.mockRejectedValue(new Error('paste denied'))
        if (failure === 'empty') mockHasStrings.mockResolvedValue({ value: false })
        if (failure === 'missing-plugin') mockHasStrings.mockRejectedValue(new Error('plugin unavailable'))
        await expect(restoreDeferredContext()).resolves.toBeNull()
        const registration = await ensureSignupAttributionForRegistration()
        expect(registration?.firstTouch).toEqual({ occurredAt: expect.any(String), path: '/setup' })
        expect(registration?.captureMethod).toBe('browser')
        expect(registration?.platform).toBe('ios')
        await restoreDeferredContext()
        expect(mockClipboardRead).toHaveBeenCalledTimes(failure === 'denied' ? 1 : 0)
    }
)

it('awaits durable native persistence when the WebView cannot retain cookies', async () => {
    const web = handoff('ios')
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: () => {} })
    mockPreferencesSet.mockImplementation(async ({ key, value }: { key: string; value: string }) => {
        // Native bridge completion is asynchronous; returning from restore
        // before this acknowledgement allows a restart to discard the source.
        await new Promise((resolve) => setTimeout(resolve, 10))
        mockNativeStorage.set(key, value)
    })

    await restoreDeferredContext()

    const persistedAtRestore = JSON.parse(mockNativeStorage.get('signup-attribution') ?? 'null')
    const registration = await ensureSignupAttributionForRegistration()
    expect(persistedAtRestore).toMatchObject({
        journeyId: web.journeyId,
        firstTouch: web.firstTouch,
    })
    expect(registration).toMatchObject({ journeyId: web.journeyId })
})

it.each(['before restore', 'after restore'] as const)('native opt-out %s prevents attachment', async (timing) => {
    handoff('android')
    if (timing === 'after restore') {
        await restoreDeferredContext()
        await markSignupAttributionPending('registrant-a')
    }
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, writable: true, value: 'production' })
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://peanut.me'
    mockOptedOut.mockReturnValue(true)
    if (timing === 'before restore') await restoreDeferredContext()

    await expect(ensureSignupAttributionForRegistration()).resolves.toBeNull()
    expect(mockNativeStorage.has('signup-attribution')).toBe(false)
    expect(mockNativeStorage.has('signup-attribution-pending')).toBe(false)
    await expect(attachSignupAttribution('registrant-a')).resolves.toBe(false)
    expect(mockApiFetch).not.toHaveBeenCalled()
})
