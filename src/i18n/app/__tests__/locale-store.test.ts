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

function setNavigatorLanguage(value: string): void {
    Object.defineProperty(navigator, 'language', { value, configurable: true })
}

type LocaleStore = typeof import('../locale-store')

function freshStore(): LocaleStore {
    let store: LocaleStore
    jest.isolateModules(() => {
        store = require('../locale-store')
    })
    return store!
}

beforeEach(() => {
    jest.clearAllMocks()
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
    it('registers the raw device language and platform as super properties (web)', async () => {
        setNavigatorLanguage('es-AR')
        const store = freshStore()
        await store.emitDeviceContextToAnalytics()
        expect(mockRegister).toHaveBeenCalledWith({ device_language: 'es-ar', platform: 'web' })
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

    it('a posthog throw never propagates', async () => {
        setNavigatorLanguage('en-US')
        mockRegister.mockImplementation(() => {
            throw new Error('sdk exploded')
        })
        const store = freshStore()
        await expect(store.emitDeviceContextToAnalytics()).resolves.toBeUndefined()
    })
})
