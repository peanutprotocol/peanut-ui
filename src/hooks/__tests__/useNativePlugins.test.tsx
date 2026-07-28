// deferred-deep-link wiring in useNativePlugins: the restored dest must land
// unless a real deep link actually navigated, and the restored locale must be
// applied via setLocale — this is the only place either happens, so it needs
// its own coverage (the pure payload logic is tested in deferred-link.test.ts).
import { renderHook, waitFor } from '@testing-library/react'
import { useNativePlugins } from '../useNativePlugins'
import { restoreDeferredContext } from '@/utils/deferred-link'

const push = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push, back: jest.fn() }),
}))

jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn() }))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => true),
    getPlatform: jest.fn(() => 'android-native'),
}))

const setLocale = jest.fn(() => Promise.resolve())
jest.mock('@/i18n/app/AppIntlProvider', () => ({
    useAppLocale: () => ({ locale: 'en', setLocale }),
}))

jest.mock('@/i18n/app/locale-store', () => ({
    localeApplied: jest.fn(() => Promise.resolve()),
}))

jest.mock('@/services/onesignal', () => ({
    getOneSignalAdapter: jest.fn(() => Promise.resolve({ onNotificationClick: jest.fn(() => () => {}) })),
}))

let launchUrl: string | undefined
jest.mock('@capacitor/app', () => ({
    App: {
        getLaunchUrl: jest.fn(() => Promise.resolve(launchUrl ? { url: launchUrl } : undefined)),
        addListener: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
        minimizeApp: jest.fn(),
    },
}))

jest.mock('@capacitor/status-bar', () => ({
    StatusBar: { setOverlaysWebView: jest.fn(), setStyle: jest.fn(), setBackgroundColor: jest.fn() },
    Style: { Light: 'LIGHT' },
}))

jest.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: jest.fn() } }))

jest.mock('@/utils/deferred-link', () => ({
    restoreDeferredContext: jest.fn(() => Promise.resolve(null)),
}))

const mockRestore = restoreDeferredContext as jest.MockedFunction<typeof restoreDeferredContext>

beforeEach(() => {
    jest.clearAllMocks()
    launchUrl = undefined
})

describe('useNativePlugins deferred restore wiring', () => {
    it('pushes the restored dest and applies the locale when there is no launch url', async () => {
        mockRestore.mockResolvedValue({ dest: '/claim?x=1', locale: 'es-419' })

        renderHook(() => useNativePlugins())

        await waitFor(() => expect(push).toHaveBeenCalledWith('/claim?x=1'))
        await waitFor(() => expect(setLocale).toHaveBeenCalledWith('es-419'))
    })

    it('yields the landing to a deep link that actually navigated, but still applies the locale', async () => {
        launchUrl = 'https://peanut.me/home'
        mockRestore.mockResolvedValue({ dest: '/claim?x=1', locale: 'pt-BR' })

        renderHook(() => useNativePlugins())

        await waitFor(() => expect(setLocale).toHaveBeenCalledWith('pt-BR'))
        expect(push).toHaveBeenCalledWith('/home')
        expect(push).not.toHaveBeenCalledWith('/claim?x=1')
    })

    it('still pushes the restored dest when the launch url was rejected (off-host)', async () => {
        launchUrl = 'https://evil.com/x'
        mockRestore.mockResolvedValue({ dest: '/claim?x=1', locale: null })

        renderHook(() => useNativePlugins())

        await waitFor(() => expect(push).toHaveBeenCalledWith('/claim?x=1'))
        expect(setLocale).not.toHaveBeenCalled()
    })

    it('a restore failure never breaks the rest of init', async () => {
        mockRestore.mockRejectedValue(new Error('boom'))

        renderHook(() => useNativePlugins())

        const { SplashScreen } = jest.requireMock('@capacitor/splash-screen')
        await waitFor(() => expect(SplashScreen.hide).toHaveBeenCalled())
        expect(push).not.toHaveBeenCalled()
    })
})
