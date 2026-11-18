/**
 * Shared state and module factories for the 01 Landing suites (contract P1). Each suite wires them with its own
 * hoisted `jest.mock(path, () => require('./landing-state').<factory>())`. Only dev dependencies are mocked, never
 * a builder's module: the screen must keep calling useLogin, useSetupFlow, the draft helpers and the platform hooks.
 * No app imports at the top: the factories run while jest resolves other mocks.
 */
export type LandingPlatform = 'iphone' | 'android' | 'web' | 'keep-web'

export const landing = {
    login: jest.fn(),
    next: jest.fn(),
    reset: jest.fn(),
    discard: jest.fn(),
    toastError: jest.fn(),
    sentry: jest.fn(),
    draft: null as { userId?: string } | null,
    isLoggingIn: false,
    native: true,
    android: false,
    hydrated: true,
    keepWeb: false,
    testBuild: false,
    deviceType: 'ios',
}

/** Contract P1 § 7 platforms. */
export function setPlatform(platform: LandingPlatform) {
    landing.native = platform === 'iphone' || platform === 'android'
    landing.android = platform === 'android'
    landing.keepWeb = platform === 'keep-web'
    landing.deviceType = platform === 'android' ? 'android' : platform === 'iphone' ? 'ios' : 'web'
}

export function resetLanding() {
    for (const fn of [
        landing.login,
        landing.next,
        landing.reset,
        landing.discard,
        landing.toastError,
        landing.sentry,
    ]) {
        fn.mockReset()
    }
    landing.login.mockResolvedValue(undefined)
    landing.draft = null
    landing.isLoggingIn = false
    landing.hydrated = true
    landing.testBuild = false
    setPlatform('iphone')
}

export const useLoginModule = () => ({
    useLogin: () => ({ handleLoginClick: landing.login, isLoggingIn: landing.isLoggingIn }),
})
export const useSetupFlowModule = () => ({
    ...jest.requireActual('@/hooks/useSetupFlow'),
    useSetupFlow: () => ({ handleNext: landing.next, isLoading: false }),
})
export const setupFlowContextModule = () => ({
    ...jest.requireActual('@/features/setup/SetupFlowContext'),
    useOptionalSetupFlow: () => ({ resetSetupFlow: landing.reset, signupEntryFlow: 'default' }),
})
export const signupDraftModule = () => ({
    ...jest.requireActual('@/features/setup/signup-draft'),
    readSignupDraft: () => landing.draft,
    discardSignupDraft: () => landing.discard(),
})
export const capacitorModule = () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => landing.native,
    isNativeBridge: () => landing.native,
    isIOSNative: () => landing.native && !landing.android,
    isAndroidNative: () => landing.native && landing.android,
    isAndroidNativeBridge: () => landing.native && landing.android,
    isIOSNativeBridge: () => landing.native && !landing.android,
    getPlatform: () => (landing.native ? (landing.android ? 'android-native' : 'ios-native') : 'web'),
    openExternalUrl: jest.fn(),
})
export const nativePlatformModule = () => ({
    ...jest.requireActual('@/utils/native-platform'),
    useNativePlatform: () => ({
        isCapacitor: landing.native,
        isNativeBridge: landing.native,
        isIOSNative: landing.native && !landing.android,
        isAndroidNative: landing.native && landing.android,
        isAndroidNativeBridge: landing.native && landing.android,
        platform: landing.native ? (landing.android ? 'android-native' : 'ios-native') : 'web',
        isHydrated: landing.hydrated,
    }),
})
export const deviceTypeModule = () => ({
    DeviceType: { IOS: 'ios', ANDROID: 'android', WEB: 'web' },
    useDeviceType: () => ({ deviceType: landing.deviceType }),
})
export const keepWebModule = () => ({ useKeepWebBypass: () => landing.keepWeb })
export const migrationModule = () => ({
    ...jest.requireActual('@/constants/migration.consts'),
    get TEST_WEB_SIGNUP() {
        return landing.testBuild
    },
})
export const storeButtonsModule = () => ({
    __esModule: true,
    default: ({ onStoreClick }: { onStoreClick?: (store: string) => void }) => (
        <button data-testid="store-buttons" onClick={() => onStoreClick?.('ios')}>
            App Store
        </button>
    ),
})
export const toastModule = () => ({ useToast: () => ({ error: landing.toastError }) })
export const sentryModule = () => ({
    captureException: (...args: unknown[]) => landing.sentry(...args),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
})
export const posthogModule = () => ({
    __esModule: true,
    default: {
        capture: jest.fn(),
        register: jest.fn(),
        onFeatureFlags: jest.fn(() => () => {}),
        isFeatureEnabled: jest.fn(() => false),
        getFeatureFlag: jest.fn(() => undefined),
    },
})
export const languageSwitcherModule = () => ({ SetupLanguageSwitcher: () => null })

/** lottie-web's light player (the walking rig): a stub animation that holds whatever frame it is sent. */
export const lottieModule = () => ({
    __esModule: true,
    default: {
        loadAnimation: () => ({
            totalFrames: 40,
            goToAndStop: jest.fn(),
            play: jest.fn(),
            pause: jest.fn(),
            stop: jest.fn(),
            destroy: jest.fn(),
            setSpeed: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        }),
    },
})
