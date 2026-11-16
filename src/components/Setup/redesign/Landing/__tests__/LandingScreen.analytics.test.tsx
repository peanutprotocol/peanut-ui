/** @jest-environment jsdom */
// Contract P1 (01 Landing): analytics as on dev, minus welcome_variant (ruling 7). Checks P1-31…P1-35.
// Ported from Views/__tests__/Landing.test.tsx ("control analytics").
jest.mock('@/hooks/useLogin', () => require('./landing-state').useLoginModule())
jest.mock('@/hooks/useSetupFlow', () => require('./landing-state').useSetupFlowModule())
jest.mock('@/features/setup/SetupFlowContext', () => require('./landing-state').setupFlowContextModule())
jest.mock('@/features/setup/signup-draft', () => require('./landing-state').signupDraftModule())
jest.mock('@/utils/capacitor', () => require('./landing-state').capacitorModule())
jest.mock('@/utils/native-platform', () => require('./landing-state').nativePlatformModule())
jest.mock('@/hooks/useGetDeviceType', () => require('./landing-state').deviceTypeModule())
jest.mock('@/hooks/useKeepWebBypass', () => require('./landing-state').keepWebModule())
jest.mock('@/constants/migration.consts', () => require('./landing-state').migrationModule())
jest.mock('@/components/Migration/StoreButtons', () => require('./landing-state').storeButtonsModule())
jest.mock('@/components/0_Bruddle/Toast', () => require('./landing-state').toastModule())
jest.mock('@sentry/nextjs', () => require('./landing-state').sentryModule())
jest.mock('@/utils/sentry-lazy', () => require('./landing-state').sentryModule())
jest.mock('posthog-js', () => require('./landing-state').posthogModule())
jest.mock('lottie-web/build/player/lottie_light', () => require('./landing-state').lottieModule())
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () =>
    require('./landing-state').languageSwitcherModule()
)

import { fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { LandingScreen } from '@/components/Setup/redesign/Landing/LandingScreen'
import { landing, resetLanding, setPlatform } from './landing-state'
import { named, passkeyError, signUpButton, tapLogIn } from './landing-helpers'
import { controlsOf, eventsOf, msg, renderInShell } from './redesign-harness'

const capture = () => jest.mocked(posthog.capture) as unknown as jest.Mock
const controls = () => controlsOf(capture())
const recoveryActions = () =>
    eventsOf(capture(), ANALYTICS_EVENTS.LOGIN_RECOVERY_ACTION).map((properties) => properties.action)

beforeEach(() => {
    jest.useFakeTimers()
    resetLanding()
    capture().mockClear()
    jest.mocked(posthog.register).mockClear()
})
afterEach(() => jest.useRealTimers())

describe('01 Landing — analytics (§ 4)', () => {
    it('P1-31 Sign up then Log in on screen_id landing: sign_up:tap, log_in:tap; signup_signup_clicked once with no welcome_variant', async () => {
        renderInShell('landing', <LandingScreen />)
        fireEvent.click(signUpButton())
        await tapLogIn()
        await waitFor(() => expect(landing.login).toHaveBeenCalledTimes(1))

        expect(controls()).toEqual(['sign_up:tap', 'log_in:tap'])
        const used = eventsOf(capture(), ANALYTICS_EVENTS.CONTROL_USED)
        expect(used.every((properties) => properties.screen_id === 'landing')).toBe(true)
        const clicked = capture().mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_CLICKED)
        expect(clicked).toHaveLength(1)
        expect(clicked[0][1] ?? {}).toEqual({})
        expect(JSON.stringify(capture().mock.calls)).not.toContain('welcome_variant')
        expect(JSON.stringify(jest.mocked(posthog.register).mock.calls)).not.toContain('welcome_variant')
    })

    it('P1-32 PASSKEY_NOT_FOUND, Retry, PASSKEY_NOT_FOUND, Escape: the exact control sequence and recovery actions', async () => {
        landing.login.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await screen.findByRole('dialog')
        fireEvent.click(screen.getByRole('button', { name: named(msg('common.retry')) }))
        await waitFor(() => expect(landing.login).toHaveBeenCalledTimes(2))
        fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
        await waitFor(() => expect(recoveryActions()).toEqual(['retry', 'dismiss']))

        expect(controls()).toEqual([
            'log_in:tap',
            'log_in:error:PASSKEY_NOT_FOUND',
            'login_recovery:open',
            'recovery_retry:tap',
            'log_in:error:PASSKEY_NOT_FOUND',
            'login_recovery:open',
            'login_recovery:dismiss',
        ])
    })

    it('P1-33 each error captures signup_login_error with error_code, native and recovery_drawer', async () => {
        const loginErrors = () => eventsOf(capture(), ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR)

        landing.login
            .mockRejectedValueOnce(passkeyError('LOGIN_ERROR'))
            .mockRejectedValueOnce(passkeyError('ACCOUNT_DELETED'))
        let view = renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await waitFor(() => expect(loginErrors()).toHaveLength(1))
        await tapLogIn()
        await waitFor(() => expect(loginErrors()).toHaveLength(2))
        view.unmount()

        landing.login.mockRejectedValueOnce(passkeyError('PASSKEY_NOT_FOUND'))
        view = renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await screen.findByRole('dialog')
        view.unmount()

        landing.login.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await waitFor(() => expect(loginErrors()).toHaveLength(4))
        await tapLogIn()
        await waitFor(() => expect(loginErrors()).toHaveLength(5))

        expect(loginErrors()).toEqual([
            { error_code: 'LOGIN_ERROR', native: true, recovery_drawer: false },
            { error_code: 'ACCOUNT_DELETED', native: true, recovery_drawer: false },
            { error_code: 'PASSKEY_NOT_FOUND', native: true, recovery_drawer: true },
            { error_code: 'LOGIN_CANCELED', native: true, recovery_drawer: false },
            { error_code: 'LOGIN_CANCELED', native: true, recovery_drawer: true },
        ])
    })

    it('P1-34 web download-only: a store button tap sends store_button:tap:<store>', () => {
        setPlatform('web')
        landing.deviceType = 'ios'
        renderInShell('landing', <LandingScreen />)
        fireEvent.click(screen.getByTestId('store-buttons'))
        expect(controls()).toEqual(['store_button:tap:ios'])
    })

    it('P1-35 drawer "I’m new" captures login_recovery_action signup and signup_signup_clicked (no properties); support captures support', async () => {
        landing.login.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        const view = renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await screen.findByRole('dialog')
        fireEvent.click(screen.getByRole('button', { name: msg('setup.loginRecovery.signUp') }))

        expect(recoveryActions()).toEqual(['signup'])
        const clicked = capture().mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_CLICKED)
        expect(clicked).toHaveLength(1)
        expect(clicked[0][1] ?? {}).toEqual({})
        expect(landing.next).toHaveBeenCalledTimes(1)
        view.unmount()

        capture().mockClear()
        renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await screen.findByRole('dialog')
        const support = screen.getByRole('link', { name: named(msg('setup.passkey.help.stillHavingIssues')) })
        expect(support).toHaveAttribute('href', 'https://peanut.me/support')
        fireEvent.click(support)
        expect(recoveryActions()).toEqual(['support'])
        expect(controls()).toContain('recovery_support:tap')
    })
})
