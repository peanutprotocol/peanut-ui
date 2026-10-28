/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import LandingStep from '../Landing'

const mockLogin = jest.fn()
const mockNext = jest.fn()
const mockToastError = jest.fn()
let mockNative = true
let mockMigrationOn = false
let mockDeviceType = 'ios'

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockNative,
    isNativeBridge: () => mockNative,
    isIOSNative: () => mockNative,
    isAndroidNative: () => false,
    isAndroidNativeBridge: () => false,
    getPlatform: () => (mockNative ? 'ios-native' : 'web'),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: false }) }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { IOS: 'ios', ANDROID: 'android', WEB: 'web' },
    useDeviceType: () => ({ deviceType: mockDeviceType }),
}))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockMigrationOn }))
jest.mock('@/components/Migration/StoreButtons', () => ({
    __esModule: true,
    default: () => <div data-testid="store-buttons" />,
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
const logIn = () => fireEvent.click(screen.getByRole('button', { name: /log in/i }))
const recoveryActions = () =>
    (posthog.capture as jest.Mock).mock.calls
        .filter(([event]) => event === ANALYTICS_EVENTS.LOGIN_RECOVERY_ACTION)
        .map(([, properties]) => properties.action)

beforeEach(() => {
    jest.clearAllMocks()
    mockNative = true
    mockMigrationOn = false
    mockDeviceType = 'ios'
})

describe('Landing — recovery after a failed login (TASK-24017)', () => {
    it('opens the recovery drawer at once when the phone holds no Peanut passkey', async () => {
        mockLogin.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderWithIntl(<LandingStep />)

        logIn()

        expect(await screen.findByRole('dialog')).toHaveTextContent('Your passkey may be on another phone')
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

        logIn()
        await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1))
        expect(mockToastError).toHaveBeenCalledWith('Passkey verification wasn’t completed. Try again when ready.')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        logIn()
        expect(await screen.findByRole('dialog')).toBeInTheDocument()
        expect(mockToastError).toHaveBeenCalledTimes(1)
    })

    it('keeps the toast for every other failure', async () => {
        mockLogin.mockRejectedValue(passkeyError('LOGIN_ERROR'))
        renderWithIntl(<LandingStep />)

        logIn()

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
        logIn()
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
        mockMigrationOn = true
        mockDeviceType = 'web'
        mockLogin.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderWithIntl(<LandingStep />)

        expect(screen.getByTestId('store-buttons')).toBeInTheDocument()
        logIn()

        expect(await screen.findByRole('dialog')).toHaveTextContent('Log in on the phone where you created Peanut.')
        expect(screen.queryByRole('button', { name: /create an account/i })).not.toBeInTheDocument()
    })
})
