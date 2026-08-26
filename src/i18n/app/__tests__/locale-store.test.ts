/**
 * Guards the analytics-emit gating in locale-store (TASK-20922): dedupe,
 * register-always vs $set-only-on-identified-change, and the fence that keeps
 * a posthog failure from breaking i18n. Module state (`current`) is reset via
 * jest.isolateModules per test.
 */

const mockRegister = jest.fn()
const mockSetPersonProperties = jest.fn()
const mockIsIdentified = jest.fn()

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        register: (...args: unknown[]) => mockRegister(...args),
        setPersonProperties: (...args: unknown[]) => mockSetPersonProperties(...args),
        _isIdentified: (...args: unknown[]) => mockIsIdentified(...args),
    },
}))

const mockIsCapacitor = jest.fn()
const mockGetPlatform = jest.fn()

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor(),
    getPlatform: () => mockGetPlatform(),
}))

const mockGetLanguageTag = jest.fn()

jest.mock('@capacitor/device', () => ({
    Device: { getLanguageTag: (...args: unknown[]) => mockGetLanguageTag(...args) },
}))

function setNavigatorLanguage(value: string): void {
    Object.defineProperty(navigator, 'language', { value, configurable: true })
}

const realLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')!

function stubLocalStorage(get: () => Storage | null): void {
    Object.defineProperty(window, 'localStorage', { get, configurable: true })
}

afterEach(() => {
    Object.defineProperty(window, 'localStorage', realLocalStorage)
    window.localStorage.clear()
})

type LocaleStore = typeof import('../locale-store')

function freshStore(): LocaleStore {
    let store: LocaleStore
    jest.isolateModules(() => {
        store = require('../locale-store')
    })
    return store!
}

beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so a mockImplementation set in one test
    // — e.g. the posthog-throw cases — can never leak into the next.
    jest.resetAllMocks()
    mockIsIdentified.mockReturnValue(true)
    mockIsCapacitor.mockReturnValue(false)
    mockGetPlatform.mockReturnValue('web')
})

describe('emitLocaleToAnalytics', () => {
    it('first emit registers the super property but never $sets (identify covers startup)', () => {
        const store = freshStore()
        store.emitLocaleToAnalytics('es-419')
        expect(mockRegister).toHaveBeenCalledWith({ app_locale: 'es-419' })
        expect(mockSetPersonProperties).not.toHaveBeenCalled()
        expect(store.currentAppLocale()).toBe('es-419')
    })

    it('same-locale re-emit is a no-op', () => {
        const store = freshStore()
        store.emitLocaleToAnalytics('en')
        store.emitLocaleToAnalytics('en')
        expect(mockRegister).toHaveBeenCalledTimes(1)
    })

    it('a real change registers and $sets for an identified user', () => {
        const store = freshStore()
        store.emitLocaleToAnalytics('en')
        store.emitLocaleToAnalytics('pt-BR')
        expect(mockRegister).toHaveBeenLastCalledWith({ app_locale: 'pt-BR' })
        expect(mockSetPersonProperties).toHaveBeenCalledTimes(1)
        expect(mockSetPersonProperties).toHaveBeenCalledWith({ app_locale: 'pt-BR' })
    })

    it('a change by an anonymous user never $sets (would force person processing)', () => {
        mockIsIdentified.mockReturnValue(false)
        const store = freshStore()
        store.emitLocaleToAnalytics('en')
        store.emitLocaleToAnalytics('es-AR')
        expect(mockSetPersonProperties).not.toHaveBeenCalled()
        expect(mockRegister).toHaveBeenCalledTimes(2)
    })

    it('a posthog throw never propagates and still records the current locale', () => {
        mockRegister.mockImplementation(() => {
            throw new Error('sdk exploded')
        })
        const store = freshStore()
        expect(() => store.emitLocaleToAnalytics('pt-BR')).not.toThrow()
        expect(store.currentAppLocale()).toBe('pt-BR')
    })
})

describe('emitDeviceContextToAnalytics', () => {
    it('registers the raw device language and platform, and exposes them for logout re-register', async () => {
        setNavigatorLanguage('es-AR')
        const store = freshStore()
        await store.emitDeviceContextToAnalytics()
        expect(mockRegister).toHaveBeenCalledWith({ device_language: 'es-ar', platform: 'web' })
        expect(store.currentDeviceContext()).toEqual({ device_language: 'es-ar', platform: 'web' })
    })

    it('reads the raw tag from the native device bridge on Capacitor', async () => {
        mockIsCapacitor.mockReturnValue(true)
        mockGetPlatform.mockReturnValue('ios-native')
        mockGetLanguageTag.mockResolvedValue({ value: 'pt-BR' })
        const store = freshStore()
        await store.emitDeviceContextToAnalytics()
        expect(mockGetLanguageTag).toHaveBeenCalled()
        expect(mockRegister).toHaveBeenCalledWith({ device_language: 'pt-br', platform: 'ios-native' })
    })

    it('keeps an unsupported language as-is (never collapses to en — protects the OKR denominator)', async () => {
        setNavigatorLanguage('fr-FR')
        const store = freshStore()
        await store.emitDeviceContextToAnalytics()
        expect(mockRegister).toHaveBeenCalledWith({ device_language: 'fr-fr', platform: 'web' })
    })

    it('emits once per session', async () => {
        setNavigatorLanguage('pt-BR')
        const store = freshStore()
        await store.emitDeviceContextToAnalytics()
        await store.emitDeviceContextToAnalytics()
        expect(mockRegister).toHaveBeenCalledTimes(1)
    })

    it('a posthog throw never propagates and leaves the context unset so a retry can register', async () => {
        setNavigatorLanguage('en-US')
        mockRegister.mockImplementationOnce(() => {
            throw new Error('sdk exploded')
        })
        const store = freshStore()
        await expect(store.emitDeviceContextToAnalytics()).resolves.toBeUndefined()
        expect(store.currentDeviceContext()).toBeNull()
        // guard is set only on success, so the next call retries instead of no-op
        await store.emitDeviceContextToAnalytics()
        expect(store.currentDeviceContext()).toEqual({ device_language: 'en-us', platform: 'web' })
    })
})

describe('localeReady', () => {
    it('falls back to the browser language when localStorage is null', async () => {
        // some Android in-app browsers (Sentry PEANUT-UI-STC) expose it as null,
        // which `typeof localStorage !== 'undefined'` happily waves through
        stubLocalStorage(() => null)
        setNavigatorLanguage('pt-BR')
        const store = freshStore()
        await expect(store.localeReady()).resolves.toBe('pt-BR')
    })

    it('still prefers a stored locale over the browser language', async () => {
        window.localStorage.setItem('app-locale', 'pt-BR')
        setNavigatorLanguage('en-US')
        const store = freshStore()
        await expect(store.localeReady()).resolves.toBe('pt-BR')
    })

    it('memoizes a usable locale rather than a rejection every later awaiter would inherit', async () => {
        stubLocalStorage(() => null)
        setNavigatorLanguage('es-419')
        const store = freshStore()
        const first = store.localeReady()
        expect(store.localeReady()).toBe(first)
        await expect(first).resolves.toBe('es-419')
    })
})
