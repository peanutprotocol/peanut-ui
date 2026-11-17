/** @jest-environment jsdom */
/*
 * 03 Passkey, orchestrator ruling (16 Nov): the passkey preflight warnings come from catalog keys in all four
 * locales (C.md § 12 C11 resolved). Key names are the builder's choice, so the checks are:
 *   1. the hard-coded English sentences are gone from src/utils/passkeyPreflight.ts;
 *   2. the warning the 03 hook shows, from the real preflight, is a string of the active locale's catalog,
 *      in en, es-AR, es-419 and pt-BR, and outside en it is not the English sentence.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { render, screen, waitFor } from '@testing-library/react'
import { CATALOGS, IntlProvider, type TestLocale } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'
import { onSignupScreen } from '@/test-utils/signup-controls'
import { useSignupPasskey } from '../useSignupPasskey'

// Some module asks isCapacitor() while the imports load, before a `let` here would exist: keep the switch global.
const native = globalThis as typeof globalThis & { __t1NativeApp?: boolean }

jest.mock('@capgo/capacitor-passkey', () => ({
    CapacitorPasskey: { isSupported: async () => ({ available: false, conditionalMediation: false }) },
}))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => (globalThis as { __t1NativeApp?: boolean }).__t1NativeApp === true,
    getNativeRpId: () => 'peanut.me',
    isIOSNativeBridge: () => false,
    isAndroidNativeBridge: () => false,
}))
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleRegister: jest.fn(), address: undefined, isRegistering: false }),
}))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: jest.fn(), isLoggingIn: false }) }))
jest.mock('@/hooks/useSetupFlow', () => ({
    postRegistrationScreen: () => 'notification-email',
    useSetupFlow: () => ({ isLoading: false, handleNext: jest.fn(), setScreenId: jest.fn() }),
}))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: 'android' }) }))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useOptionalSetupFlow: () => null,
    useSetupFlowContext: () => ({
        setNoBackLockScreenId: jest.fn(),
        setRegistrationInProgress: jest.fn(),
        setInviterAccepted: jest.fn(),
        setRefusedUsername: jest.fn(),
        steps: [],
        inviteSelection: '',
    }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: jest.fn() }) }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

/** The English warnings passkeyPreflight.ts hard-coded at the pin (c985d250e). */
const DEV_ENGLISH_WARNINGS = [
    'Passkeys aren’t available yet. Sign in to a Google account and update Google Play Services, then try again.',
    'Passkeys aren’t available on this device yet. Check your device settings and try again.',
    'We couldn’t verify passkey support. Make sure you’re signed in to a Google account with up-to-date Google Play Services, then try again.',
    'Passkeys require a secure connection (HTTPS)',
    'Passkeys are not supported on this browser',
    'Please update Chrome to use passkeys',
    'Your Android version is too old for passkeys. Please update to Android 9 or later.',
    'Please enable screen lock with PIN or biometric in your device settings',
    'Your device may have limited passkey support. If setup fails, try updating Google Play Services.',
]

const leaves = (node: unknown, out: string[] = []): string[] => {
    if (typeof node === 'string') out.push(node)
    else if (node && typeof node === 'object') for (const value of Object.values(node)) leaves(value, out)
    return out
}
const norm = (text: string) => text.replace(/ /g, ' ').trim()

function Probe() {
    const passkey = useSignupPasskey('kimi')
    return <output data-testid="warning">{passkey.preflightWarning ?? ''}</output>
}
const shownWarning = async (locale: TestLocale) => {
    render(<IntlProvider locale={locale}>{onSignupScreen('passkey', <Probe />)}</IntlProvider>)
    await waitFor(() => expect(screen.getByTestId('warning').textContent).not.toBe(''))
    return screen.getByTestId('warning').textContent ?? ''
}

const LOCALES: TestLocale[] = ['en', 'es-AR', 'es-419', 'pt-BR']

beforeEach(() => {
    native.__t1NativeApp = false
})

describe('03 Passkey — preflight warnings come from the catalogs', () => {
    it('ruling: passkeyPreflight.ts no longer holds the hard-coded English warnings', () => {
        const source = readFileSync(join(process.cwd(), 'src/utils/passkeyPreflight.ts'), 'utf8')
        const still = DEV_ENGLISH_WARNINGS.filter((warning) => source.includes(warning))
        expect(still).toEqual([])
    })

    it.each(LOCALES)(
        'ruling: a browser without WebAuthn shows a %s catalog string, not dev’s English',
        async (locale) => {
            // jsdom has no PublicKeyCredential: the preflight's "not supported on this browser" branch
            const warning = await shownWarning(locale)
            expect(leaves(CATALOGS[locale]).map(norm)).toContain(norm(warning))
            if (locale !== 'en') expect(DEV_ENGLISH_WARNINGS).not.toContain(warning)
        }
    )

    it.each(LOCALES)('ruling: the native app with no credential manager shows a %s catalog string', async (locale) => {
        native.__t1NativeApp = true
        const warning = await shownWarning(locale)
        expect(leaves(CATALOGS[locale]).map(norm)).toContain(norm(warning))
        if (locale !== 'en') expect(DEV_ENGLISH_WARNINGS).not.toContain(warning)
    })
})
