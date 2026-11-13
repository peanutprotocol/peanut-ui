/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import LandingStep from '../Landing'

const mockLogin = jest.fn()
const mockNext = jest.fn()
const mockToastError = jest.fn()
const mockCancelIOS = jest.fn()
let mockNative = true
let mockAndroidNative = false
let mockTestBuild = false
let mockDeviceType = 'ios'
let mockKeepWeb = false
let mockImmediate = false

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockNative,
    isNativeBridge: () => mockNative,
    isIOSNative: () => mockNative && !mockAndroidNative,
    isAndroidNative: () => mockNative && mockAndroidNative,
    isAndroidNativeBridge: () => mockNative && mockAndroidNative,
    getPlatform: () => (mockNative ? (mockAndroidNative ? 'android-native' : 'ios-native') : 'web'),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: false }) }))
jest.mock('@/utils/landing-passkeys', () => ({
    supportsIOSImmediateLogin: async () => mockImmediate,
    cancelIOSImmediateLogin: async () => mockCancelIOS(),
}))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { IOS: 'ios', ANDROID: 'android', WEB: 'web' },
    useDeviceType: () => ({ deviceType: mockDeviceType }),
}))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => mockKeepWeb }))
jest.mock('@/constants/migration.consts', () => ({
    ...jest.requireActual('@/constants/migration.consts'),
    get TEST_WEB_SIGNUP() {
        return mockTestBuild
    },
}))
jest.mock('@/components/Migration/StoreButtons', () => ({
    __esModule: true,
    default: ({ onStoreClick }: { onStoreClick?: (store: string) => void }) => (
        <button data-testid="store-buttons" onClick={() => onStoreClick?.('ios')}>
            App Store
        </button>
    ),
}))
jest.mock('@/components/Setup/components/SetupDocsDrawer', () => ({
    // the doc link is not under test; a plain span keeps the lint rule for page links out of it
    SetupDocLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
jest.mock('@/utils/demo', () => ({ disableDemoMode: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

/** The curated error useZeroDev.handleLogin throws. */
const passkeyError = (code: string) => Object.assign(new Error('curated'), { name: 'PasskeyError', code })
// The normal layout's button, or the web app-only layout's text link.
const LOGIN_LABEL = /^(I already have an account|Log in on web instead)$/
const logIn = async () => {
    // Use the real clock for the recovery drawer's focus and dismissal transitions.
    jest.useRealTimers()
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: LOGIN_LABEL }))
    })
}
const loginErrors = () =>
    (posthog.capture as jest.Mock).mock.calls
        .filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR)
        .map(([, properties]) => properties)
const recoveryActions = () =>
    (posthog.capture as jest.Mock).mock.calls
        .filter(([event]) => event === ANALYTICS_EVENTS.LOGIN_RECOVERY_ACTION)
        .map(([, properties]) => properties.action)

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockNative = true
    mockAndroidNative = false
    mockTestBuild = false
    mockDeviceType = 'ios'
    mockKeepWeb = false
    mockImmediate = false
})
afterEach(() => jest.useRealTimers())

describe('Landing — recovery after a failed login (TASK-24017)', () => {
    it('opens the recovery drawer at once when the phone holds no Peanut passkey', async () => {
        mockLogin.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderWithIntl(<LandingStep />)

        await logIn()

        expect(await screen.findByRole('dialog')).toHaveTextContent('Your passkey may be on the phone you signed up on')
        expect(mockToastError).not.toHaveBeenCalled()
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR,
            expect.objectContaining({ error_code: 'PASSKEY_NOT_FOUND', recovery_drawer: true })
        )
    })

    it('toasts the first cancel and opens the drawer on the second', async () => {
        mockLogin.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        renderWithIntl(<LandingStep />)

        await logIn()
        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
        expect(mockToastError).toHaveBeenCalledWith('Passkey verification wasn’t completed. Try again when ready.')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        await logIn()
        expect(await screen.findByRole('dialog')).toBeInTheDocument()
        expect(mockToastError).toHaveBeenCalledTimes(1)
    })

    it('keeps the toast for repeated cancels in the Android app, where a missing passkey is PASSKEY_NOT_FOUND', async () => {
        mockAndroidNative = true
        mockDeviceType = 'android'
        mockLogin.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        renderWithIntl(<LandingStep />)

        await logIn()
        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
        await logIn()
        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(2))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opens the recovery drawer at once in the Android app when it reports no Peanut passkey', async () => {
        mockAndroidNative = true
        mockDeviceType = 'android'
        mockLogin.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderWithIntl(<LandingStep />)

        await logIn()

        expect(await screen.findByRole('dialog')).toHaveTextContent('Your passkey may be on the phone you signed up on')
        expect(mockToastError).not.toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR,
            expect.objectContaining({ error_code: 'PASSKEY_NOT_FOUND', recovery_drawer: true })
        )
    })

    it('keeps both buttons and the two-cancel rule on the keep-web layout', async () => {
        mockNative = false
        mockKeepWeb = true
        mockDeviceType = 'web'
        mockLogin.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        renderWithIntl(<LandingStep />)

        expect(screen.getByRole('button', { name: 'Sign up' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'I already have an account' })).toBeEnabled()
        expect(screen.queryByTestId('store-buttons')).not.toBeInTheDocument()

        await logIn()
        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        await logIn()
        expect(await screen.findByRole('dialog')).toBeInTheDocument()
        expect(mockToastError).toHaveBeenCalledTimes(1)
    })

    it('keeps the store buttons and the text link on the web app-only layout', () => {
        mockNative = false
        mockDeviceType = 'web'
        renderWithIntl(<LandingStep />)

        expect(screen.getByTestId('store-buttons')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Log in on web instead' })).toBeEnabled()
        expect(screen.queryByRole('button', { name: 'I already have an account' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument()
    })

    it('keeps the toast for every other failure', async () => {
        mockLogin.mockRejectedValue(passkeyError('LOGIN_ERROR'))
        renderWithIntl(<LandingStep />)

        await logIn()

        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR,
            expect.objectContaining({ error_code: 'LOGIN_ERROR', recovery_drawer: false })
        )
    })

    it('retries from the drawer with one more login, then signs up from it', async () => {
        mockLogin.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderWithIntl(<LandingStep />)
        await logIn()
        await screen.findByRole('dialog')

        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(2))
        // the retry failed the same way, so the drawer is back
        expect(await screen.findByRole('dialog')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'I’m new, create an account' }))
        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_CLICKED)
        expect(recoveryActions()).toEqual(['retry', 'signup'])
    })

    it('offers no sign-up from the drawer on the web app-only layout', async () => {
        mockNative = false
        mockDeviceType = 'web'
        mockLogin.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderWithIntl(<LandingStep />)

        expect(screen.getByTestId('store-buttons')).toBeInTheDocument()
        await logIn()

        expect(await screen.findByRole('dialog')).toHaveTextContent('Log in on that phone.')
        expect(screen.queryByRole('button', { name: /create an account/i })).not.toBeInTheDocument()
    })
})

describe('Landing — the automatic iPhone login counts as the first cancel (TASK-24885)', () => {
    /** The automatic attempt (called with options) ends with `auto`; manual logins (no options) take `manual` in turn. */
    const loginOutcomes = (auto: string, ...manual: string[]) => {
        mockImmediate = true
        mockLogin.mockImplementation((options?: object) =>
            Promise.reject(passkeyError(options ? auto : (manual.shift() ?? 'LOGIN_CANCELED')))
        )
    }
    // The landing frees the native slot once the automatic attempt has settled on its own.
    const autoLoginSettled = async () => {
        await waitFor(() => expect(mockCancelIOS).toHaveBeenCalledTimes(1))
        await act(async () => {})
    }

    it.each(['LOGIN_CANCELED', 'PASSKEY_NOT_FOUND'])(
        'opens the recovery drawer on the first manual cancel after the automatic attempt ends %s',
        async (code) => {
            loginOutcomes(code, 'LOGIN_CANCELED')
            renderWithIntl(<LandingStep />)
            await autoLoginSettled()

            // The miss itself stays silent.
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
            expect(mockToastError).not.toHaveBeenCalled()
            expect(Sentry.captureException).not.toHaveBeenCalled()
            expect(loginErrors()).toEqual([])

            await logIn()

            expect(await screen.findByRole('dialog')).toHaveTextContent(
                'Your passkey may be on the phone you signed up on'
            )
            expect(mockToastError).not.toHaveBeenCalled()
            expect(mockLogin).toHaveBeenCalledTimes(2)
            expect(mockLogin).toHaveBeenLastCalledWith()
            expect(loginErrors()).toEqual([
                expect.objectContaining({
                    error_code: 'LOGIN_CANCELED',
                    recovery_drawer: true,
                    after_auto_miss: true,
                }),
            ])
        }
    )

    it('does not count an automatic attempt that ends with any other code', async () => {
        loginOutcomes('LOGIN_ERROR', 'LOGIN_CANCELED')
        renderWithIntl(<LandingStep />)
        await autoLoginSettled()

        await logIn()

        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
        expect(mockToastError).toHaveBeenCalledWith('Passkey verification wasn’t completed. Try again when ready.')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(loginErrors()).toEqual([expect.objectContaining({ recovery_drawer: false, after_auto_miss: false })])
    })

    it('resets the count when a manual login fails another way after a counted miss', async () => {
        loginOutcomes('LOGIN_CANCELED', 'LOGIN_ERROR', 'LOGIN_CANCELED')
        renderWithIntl(<LandingStep />)
        await autoLoginSettled()

        await logIn()
        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
        expect(mockToastError).toHaveBeenLastCalledWith(
            'We couldn’t verify your passkey. Please try again, or contact support if it keeps happening.'
        )

        await logIn()
        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(2))
        expect(mockToastError).toHaveBeenLastCalledWith('Passkey verification wasn’t completed. Try again when ready.')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(loginErrors()).toEqual([
            expect.objectContaining({ error_code: 'LOGIN_ERROR', recovery_drawer: false, after_auto_miss: true }),
            expect.objectContaining({ error_code: 'LOGIN_CANCELED', recovery_drawer: false, after_auto_miss: true }),
        ])
    })

    it('never counts a cancel in the Android app, which has no automatic attempt', async () => {
        mockAndroidNative = true
        mockDeviceType = 'android'
        loginOutcomes('LOGIN_CANCELED', 'LOGIN_CANCELED')
        renderWithIntl(<LandingStep />)

        await logIn()

        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockLogin).toHaveBeenCalledWith()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(loginErrors()).toEqual([expect.objectContaining({ recovery_drawer: false, after_auto_miss: false })])
    })
})

describe('Landing — test-build web sign-up', () => {
    it('offers no web sign-up on a peanut.me build', () => {
        mockNative = false
        renderWithIntl(<LandingStep />)

        expect(screen.getByTestId('store-buttons')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Sign up on web' })).not.toBeInTheDocument()
        expect(screen.queryByText('Test build')).not.toBeInTheDocument()
    })

    it('marks the web sign-up on other builds and starts signup from it', () => {
        mockNative = false
        mockTestBuild = true
        renderWithIntl(<LandingStep />)

        expect(screen.getByText('Test build')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Sign up on web' }))

        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_CLICKED)
    })

    it('keeps the normal sign-up in the native app, with no test row', () => {
        mockTestBuild = true
        renderWithIntl(<LandingStep />)

        expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
        expect(screen.queryByText('Test build')).not.toBeInTheDocument()
    })
})

describe('Landing — deleted account', () => {
    it('says the account was deleted, points to Sign up and stays out of Sentry', async () => {
        mockLogin.mockRejectedValue(passkeyError('ACCOUNT_DELETED'))
        renderWithIntl(<LandingStep />)

        await logIn()

        expect(await screen.findByTestId('account-deleted')).toHaveTextContent(
            'This account was deleted. Sign up to create a new one.'
        )
        expect(mockToastError).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR,
            expect.objectContaining({ error_code: 'ACCOUNT_DELETED', recovery_drawer: false })
        )

        fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
        expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('clears the message when Log in is tapped again', async () => {
        mockLogin.mockRejectedValueOnce(passkeyError('ACCOUNT_DELETED')).mockResolvedValueOnce(undefined)
        renderWithIntl(<LandingStep />)

        await logIn()
        await screen.findByTestId('account-deleted')
        await logIn()

        await waitFor(() => expect(screen.queryByTestId('account-deleted')).not.toBeInTheDocument())
    })

    it('shows the message above the store buttons on the web app-only layout', async () => {
        mockNative = false
        mockDeviceType = 'web'
        mockLogin.mockRejectedValue(passkeyError('ACCOUNT_DELETED'))
        renderWithIntl(<LandingStep />)

        await logIn()

        const message = await screen.findByTestId('account-deleted')
        expect(message.compareDocumentPosition(screen.getByTestId('store-buttons'))).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING
        )
    })
})

describe('Landing — control analytics', () => {
    const controls = () => signupControls(posthog.capture as jest.Mock)

    it('reports Sign up and Log in taps on the landing screen', async () => {
        mockLogin.mockResolvedValue(undefined)
        renderWithIntl(onSignupScreen('landing', <LandingStep />))
        fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
        await logIn()
        await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1))
        expect(controls()).toEqual(['sign_up:tap', 'log_in:tap'])
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_CLICKED)
    })

    it('reports each recovery drawer action and a dismissal', async () => {
        mockLogin.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderWithIntl(onSignupScreen('landing', <LandingStep />))
        await logIn()
        await screen.findByRole('dialog')
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(2))
        fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
        await waitFor(() => expect(recoveryActions()).toEqual(['retry', 'dismiss']))
        expect(controls()).toEqual(['log_in:tap', 'recovery_retry:tap', 'login_recovery:dismiss'])
    })

    it('reports the store button on the web app-only layout', () => {
        mockNative = false
        mockDeviceType = 'ios'
        renderWithIntl(onSignupScreen('landing', <LandingStep />))
        fireEvent.click(screen.getByTestId('store-buttons'))
        expect(controls()).toEqual(['store_button:tap:ios'])
    })
})
