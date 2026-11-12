/** @jest-environment jsdom */
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { useSignupPasskey } from '../useSignupPasskey'

// A fresh mock per test: a ceremony left running by an earlier test keeps its own
// reference, so it can never add calls to the next test's count.
let mockHandleRegister = jest.fn()
const mockApiFetch = jest.fn()
const mockLogin = jest.fn()
const mockSupport = jest.fn(async () => ({ isSupported: true }) as { isSupported: boolean; warning?: string })
let mockAddress: string | undefined
let mockIsRegistering = false
const mockSetNoBackLock = jest.fn()
const mockSetScreenId = jest.fn()
const mockSetRegistrationInProgress = jest.fn()
const mockSetInviterAccepted = jest.fn()
const mockBindSignupDraft = jest.fn(async (..._args: unknown[]) => {})
const mockSaveSignupDraft = jest.fn()
const mockFetchUser = jest.fn(async () => null)
const mockNext = jest.fn()
let mockHandleNext = mockNext
let mockDeviceType = 'android'
let mockIOSNativeBridge = false
let mockAndroidNativeBridge = false
// The OS sheet's own duration for the attempt, as the telemetry wrapper records it.
let mockCeremony: { durationMs: number } | undefined

jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleRegister: mockHandleRegister, address: mockAddress, isRegistering: mockIsRegistering }),
}))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: false }) }))
jest.mock('@/hooks/useSetupFlow', () => ({
    postRegistrationScreen: () => 'notification-email',
    useSetupFlow: () => ({ isLoading: false, handleNext: mockHandleNext, setScreenId: mockSetScreenId }),
}))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: mockDeviceType }) }))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isIOSNativeBridge: () => mockIOSNativeBridge,
    isAndroidNativeBridge: () => mockAndroidNativeBridge,
}))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({
        setNoBackLockScreenId: mockSetNoBackLock,
        registrationInProgress: false,
        setRegistrationInProgress: mockSetRegistrationInProgress,
        setInviterAccepted: mockSetInviterAccepted,
        steps: [],
        inviteSelection: '',
        residenceCountry: 'BR',
        nationalityCountry: '',
        fundingChannel: 'bank',
        paymentChannel: 'card',
        notificationChoices: null,
        inviterAccepted: false,
        sellScreensCountry: 'BR',
    }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'new-user', username: 'kimi' } }, fetchUser: mockFetchUser }),
}))
jest.mock('@/features/setup/signup-draft', () => ({
    bindSignupDraft: (...args: unknown[]) => mockBindSignupDraft(...args),
    saveSignupDraft: (...args: unknown[]) => mockSaveSignupDraft(...args),
}))
jest.mock('@/services/pending-invite-attribution', () => ({ settlePendingInviteAttribution: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/passkeyPreflight', () => ({ checkPasskeySupport: () => mockSupport() }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({ latestCeremony: () => mockCeremony }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

/** The passkey screen's ceremony, recovery, and completion state. */
function Harness({ username = 'kimi' }: { username?: string }) {
    const passkey = useSignupPasskey(username)
    return (
        <div>
            <button disabled={passkey.isClaiming} onClick={() => void passkey.claim()}>
                Claim
            </button>
            {passkey.usernameTaken && <button onClick={() => void passkey.logIn()}>Log in</button>}
            {passkey.inlineError && <p role="alert">{passkey.inlineError}</p>}
            {passkey.preflightWarning && <p data-testid="preflight">{passkey.preflightWarning}</p>}
            {passkey.isHelpOpen && <div role="dialog">{passkey.helpErrorName}</div>}
            {passkey.isHelpOpen && <button onClick={passkey.retryFromHelp}>Retry</button>}
            {passkey.isProviderUnsupportedOpen && (
                <div
                    role="dialog"
                    aria-label="Unsupported passkey provider"
                    data-platform={passkey.providerUnsupportedPlatform}
                >
                    {passkey.browserOpenFailed && <p>The browser did not open</p>}
                    <button onClick={passkey.retryFromProviderUnsupported}>Retry with another provider</button>
                    <button onClick={passkey.signUpInBrowser}>Sign up in a browser</button>
                </div>
            )}
        </div>
    )
}
const claim = () => fireEvent.click(screen.getByRole('button', { name: 'Claim' }))
const failedEvents = () =>
    (posthog.capture as jest.Mock).mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED)

beforeEach(() => {
    jest.clearAllMocks()
    mockAddress = undefined
    mockIsRegistering = false
    mockHandleNext = mockNext
    mockDeviceType = 'android'
    mockIOSNativeBridge = false
    mockAndroidNativeBridge = false
    mockCeremony = undefined
    mockSupport.mockImplementation(async () => ({ isSupported: true }))
    // 404 = username free, so the handler proceeds to registration
    mockApiFetch.mockResolvedValue({ status: 404 })
    mockHandleRegister = jest.fn(() => new Promise(() => {}))
})

describe('useSignupPasskey — one tap, one ceremony', () => {
    it.each(['', 'kim', '1234', 'waytoolongname', 'has.dot'])(
        'returns invalid draft username %s to Claim without a ceremony',
        async (username) => {
            renderWithIntl(<Harness username={username} />)
            claim()
            await waitFor(() => expect(mockSetScreenId).toHaveBeenCalledWith('signup'))
            expect(mockHandleRegister).not.toHaveBeenCalled()
            expect(mockApiFetch).not.toHaveBeenCalled()
            expect(mockBindSignupDraft).not.toHaveBeenCalled()
        }
    )

    /*
     * PEANUT-UI-T09: `isRegistering` only goes true once handleRegister runs,
     * and two awaits precede it (support re-check + username lookup). Every
     * extra tap in that window used to start its own registration.
     */
    it('ignores taps that land while the pre-ceremony checks are still running', async () => {
        mockApiFetch.mockImplementation(() => new Promise<{ status: number }>(() => {}))
        renderWithIntl(<Harness />)
        claim()
        claim()
        claim()
        await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it('is busy for the whole handler, not just the ceremony', async () => {
        renderWithIntl(<Harness />)
        claim()
        await waitFor(() => expect(screen.getByRole('button', { name: 'Claim' })).toBeDisabled())
        await waitFor(() => expect(mockHandleRegister).toHaveBeenCalledTimes(1))
        expect(mockHandleRegister).toHaveBeenCalledWith('kimi')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_PASSKEY_STARTED, {
            device_type: 'android',
        })
    })

    it('stays busy while the registration flag is up after the handler returns', () => {
        mockIsRegistering = true
        renderWithIntl(<Harness />)
        expect(screen.getByRole('button', { name: 'Claim' })).toBeDisabled()
    })
})

describe('registration success', () => {
    it('advances exactly once to notification-email, binds the draft, and locks the way back after registration', async () => {
        mockHandleRegister.mockResolvedValue(undefined)
        const view = renderWithIntl(<Harness />)
        claim()
        await waitFor(() => expect(mockHandleRegister).toHaveBeenCalledTimes(1))
        expect(mockNext).not.toHaveBeenCalled()
        mockAddress = '0x1234'
        view.rerender(<Harness />)
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSetNoBackLock).toHaveBeenCalledWith('notification-email')
        expect(mockBindSignupDraft).toHaveBeenCalledWith(
            'new-user',
            expect.objectContaining({
                screenId: 'passkey',
                answers: expect.objectContaining({ username: 'kimi', residenceCountry: 'BR' }),
            })
        )
        expect(mockSetRegistrationInProgress).toHaveBeenCalledWith(true)
        expect(mockSetRegistrationInProgress).toHaveBeenLastCalledWith(false)
        expect(mockSetNoBackLock.mock.invocationCallOrder[0]).toBeLessThan(mockNext.mock.invocationCallOrder[0])
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_PASSKEY_SUCCEEDED, {
            device_type: 'android',
        })
        // An exiting step gets the next step's fresh callback during the transition.
        mockHandleNext = jest.fn()
        view.rerender(<Harness />)
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(mockSetNoBackLock).toHaveBeenCalledTimes(1)
    })

    it('never advances on a stale address that was present before any tap', async () => {
        mockAddress = '0xstale'
        const view = renderWithIntl(<Harness />)
        view.rerender(<Harness />)
        await waitFor(() => expect(mockSupport).toHaveBeenCalled())
        expect(mockNext).not.toHaveBeenCalled()
        expect(mockSetNoBackLock).not.toHaveBeenCalled()
    })

    it('does not advance when an address appears after a failed registration', async () => {
        mockHandleRegister.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))
        const view = renderWithIntl(<Harness />)
        claim()
        await screen.findByRole('alert')
        mockAddress = '0xlate'
        view.rerender(<Harness />)
        expect(mockNext).not.toHaveBeenCalled()
        expect(mockSetNoBackLock).not.toHaveBeenCalled()
    })
})

describe('passkey failures and collision recovery', () => {
    it('shows the preflight warning on mount', async () => {
        mockSupport.mockImplementation(async () => ({ isSupported: false, warning: 'Passkeys are off here.' }))
        renderWithIntl(<Harness />)
        expect(await screen.findByTestId('preflight')).toHaveTextContent('Passkeys are off here.')
    })

    it('refuses an unsupported device at tap time without a ceremony', async () => {
        renderWithIntl(<Harness />)
        await waitFor(() => expect(mockSupport).toHaveBeenCalledTimes(1))
        mockSupport.mockImplementation(async () => ({ isSupported: false, warning: 'Turn on a screen lock.' }))
        claim()
        expect(await screen.findByRole('alert')).toHaveTextContent('Turn on a screen lock.')
        expect(mockHandleRegister).not.toHaveBeenCalled()
        expect(mockApiFetch).not.toHaveBeenCalled()
        expect(failedEvents()).toEqual([
            [ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, expect.objectContaining({ error_name: 'PreflightUnsupported' })],
        ])
        expect(screen.getByRole('button', { name: 'Claim' })).toBeEnabled()
    })

    it('falls back to the generic copy when an unsupported device gives no warning', async () => {
        renderWithIntl(<Harness />)
        await waitFor(() => expect(mockSupport).toHaveBeenCalledTimes(1))
        mockSupport.mockImplementation(async () => ({ isSupported: false }))
        claim()
        expect(await screen.findByRole('alert')).toHaveTextContent(
            "Passkeys aren't available on this device yet. Please try again."
        )
    })

    it('routes an already registered username to Log in before any ceremony', async () => {
        mockApiFetch.mockResolvedValue({ status: 200 })
        renderWithIntl(<Harness />)
        claim()
        fireEvent.click(await screen.findByRole('button', { name: 'Log in' }))
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
        expect(failedEvents()).toEqual([
            [ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, expect.objectContaining({ error_code: 'USERNAME_TAKEN' })],
        ])
    })

    it('recovers from a username collision after the availability check without another ceremony', async () => {
        mockHandleRegister.mockRejectedValue(
            Object.assign(new Error('Username already taken'), { name: 'UsernameTaken' })
        )
        mockApiFetch.mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ status: 200 })
        renderWithIntl(<Harness />)
        claim()
        fireEvent.click(await screen.findByRole('button', { name: 'Log in' }))
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(failedEvents()).toEqual([
            [ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, expect.objectContaining({ error_code: 'USERNAME_TAKEN' })],
        ])
    })

    it('returns to Claim when registration reports a collision but the public lookup is unregistered', async () => {
        mockHandleRegister.mockRejectedValue(Object.assign(new Error('Username reserved'), { name: 'UsernameTaken' }))
        renderWithIntl(<Harness />)
        claim()
        await waitFor(() => expect(mockSetScreenId).toHaveBeenCalledWith('signup'))
        expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument()
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
        expect(mockSetNoBackLock).not.toHaveBeenCalled()
        expect(mockBindSignupDraft).not.toHaveBeenCalled()
    })

    it('shows a curated message when Log in itself fails', async () => {
        mockApiFetch.mockResolvedValue({ status: 200 })
        mockLogin.mockRejectedValueOnce(new Error('Login exploded'))
        renderWithIntl(<Harness />)
        claim()
        fireEvent.click(await screen.findByRole('button', { name: 'Log in' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Login exploded')
    })

    // The native availability check (GET) hides deleted accounts, but /register/options still
    // holds their username, so the 409 sends the user to a Log in that cannot succeed.
    it('asks for another username when the taken username belongs to a deleted account', async () => {
        mockHandleRegister.mockRejectedValue(
            Object.assign(new Error('Username already exists'), { name: 'UsernameTaken' })
        )
        mockLogin.mockRejectedValueOnce(
            Object.assign(new Error('curated'), { name: 'PasskeyError', code: 'ACCOUNT_DELETED' })
        )
        mockApiFetch.mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ status: 200 })
        renderWithIntl(<Harness />)
        claim()
        fireEvent.click(await screen.findByRole('button', { name: 'Log in' }))

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'This account was deleted. Choose a different username to create a new one.'
        )
        expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument()
    })

    it('treats a plain NotAllowedError as an unfinished verification the user can retry', async () => {
        mockHandleRegister.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))
        renderWithIntl(<Harness />)
        claim()
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Passkey verification wasn’t completed. Try again when ready.'
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Claim' })).toBeEnabled()
    })

    it('opens the help drawer for a NotAllowedError in private mode', async () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        try {
            mockHandleRegister.mockRejectedValue(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }))
            renderWithIntl(<Harness />)
            claim()
            expect(await screen.findByRole('dialog')).toHaveTextContent('NotAllowedError')
        } finally {
            setItem.mockRestore()
        }
    })

    it.each(['NotReadableError', 'InvalidStateError', 'NotSupportedError'])(
        'opens the help drawer for %s and retries from it with one more ceremony',
        async (name) => {
            mockHandleRegister.mockRejectedValue(Object.assign(new Error('device'), { name }))
            renderWithIntl(<Harness />)
            claim()
            // NotReadableError goes through withWebAuthnRetry's backoff first
            expect(await screen.findByRole('dialog', {}, { timeout: 5000 })).toHaveTextContent(name)
            const ceremonies = mockHandleRegister.mock.calls.length
            const failures = failedEvents().length
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
            await waitFor(() => expect(mockHandleRegister.mock.calls.length).toBeGreaterThan(ceremonies))
            // Let the retry's backoff finish here, or its failure event lands in a later test.
            await waitFor(() => expect(failedEvents()).toHaveLength(failures + 1), { timeout: 5000 })
        },
        10000
    )

    it.each(['NotAllowedError', 'NotReadableError'])(
        'reports %s once without console or Sentry exception amplification',
        async (name) => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
            try {
                mockHandleRegister.mockRejectedValue(Object.assign(new Error('expected passkey outcome'), { name }))
                renderWithIntl(<Harness />)
                claim()
                await waitFor(
                    () =>
                        expect(posthog.capture).toHaveBeenCalledWith(
                            ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED,
                            expect.objectContaining({ error_name: name })
                        ),
                    { timeout: 5000 }
                )
                expect(failedEvents()).toHaveLength(1)
                expect(Sentry.captureException).not.toHaveBeenCalled()
                expect(consoleError).not.toHaveBeenCalled()
                expect(consoleWarn).not.toHaveBeenCalled()
            } finally {
                consoleError.mockRestore()
                consoleWarn.mockRestore()
            }
        }
    )

    it('reports an unexpected registration failure once and opens the help drawer', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
        try {
            mockHandleRegister.mockRejectedValue(new Error('unexpected SDK failure'))
            renderWithIntl(<Harness />)
            claim()
            await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1))
            expect(failedEvents()).toHaveLength(1)
            expect(consoleError).not.toHaveBeenCalled()
            expect(screen.getByRole('dialog')).toHaveTextContent('UnknownError')
        } finally {
            consoleError.mockRestore()
        }
    })

    it.each([
        ['CeremonyConflictError', 'Something interrupted the passkey prompt. Please try again.'],
        ['PasskeyShimNotReadyError', 'The app is still getting ready for passkeys. Wait a moment and try again.'],
        ['CeremonyTimeoutError', 'This is taking longer than it should. Please try again.'],
    ])('shows the curated retry copy for %s', async (name, copy) => {
        mockHandleRegister.mockRejectedValue(Object.assign(new Error(name), { name }))
        renderWithIntl(<Harness />)
        claim()
        expect(await screen.findByRole('alert')).toHaveTextContent(copy)
        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('sends a timed-out registration that completed server-side to Log in, not a second ceremony', async () => {
        // free before the ceremony, registered after the timed-out verify landed
        mockApiFetch.mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ status: 200 })
        mockHandleRegister.mockRejectedValue(
            Object.assign(new Error('CeremonyTimeoutError'), { name: 'CeremonyTimeoutError' })
        )
        renderWithIntl(<Harness />)
        claim()
        expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['Device must be unlocked to perform request.', 'Unlock the device, then try again.'],
        [
            'Stolen Device Protection is enabled and biometry is required.',
            'Use Face ID or Touch ID to verify the passkey, then try again.',
        ],
        [
            'Unable to verify webcredentials association of TEAM.app with domain peanut.me. Please try again in a few seconds.',
            'Passkey verification is temporarily unavailable. Wait a few seconds and try again.',
        ],
    ])('shows specific recovery for %s', async (message, copy) => {
        mockDeviceType = 'ios'
        mockIOSNativeBridge = true
        mockHandleRegister.mockRejectedValue(
            Object.assign(new Error('The operation couldn’t be completed. ' + message), { name: 'NotAllowedError' })
        )
        renderWithIntl(<Harness />)
        claim()
        expect(await screen.findByRole('alert')).toHaveTextContent(copy)
        expect(screen.queryByText(/was cancelled/)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Claim' })).not.toBeDisabled()
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('records the platform error code that the NotAllowedError name flattens, not the message', async () => {
        mockHandleRegister.mockRejectedValue(
            Object.assign(
                new Error(
                    'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)'
                ),
                { name: 'NotAllowedError' }
            )
        )
        renderWithIntl(<Harness />)
        claim()
        await screen.findByRole('alert')
        const [[, properties]] = failedEvents()
        expect(properties).toMatchObject({
            error_name: 'NotAllowedError',
            native_error_code: 'AuthorizationError:1000',
        })
        expect(JSON.stringify(properties)).not.toContain('operation couldn')
    })
})

/*
 * The iOS app ends the ceremony as a plain cancel when iCloud Passwords is off,
 * even after its own prompt sent the user to Settings — users retried ~5 times
 * and gave up on "Try again when ready".
 */
describe('repeated cancels in the iOS app', () => {
    const cancel = (message = 'cancelled') => Object.assign(new Error(message), { name: 'NotAllowedError' })
    const claimAndSettle = async () => {
        const failures = failedEvents().length
        claim()
        await waitFor(() => expect(failedEvents()).toHaveLength(failures + 1))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Claim' })).toBeEnabled())
    }

    beforeEach(() => {
        mockDeviceType = 'ios'
        mockIOSNativeBridge = true
    })

    it('keeps the first cancel quiet and opens the iCloud help on the second', async () => {
        mockHandleRegister.mockRejectedValue(cancel())
        renderWithIntl(<Harness />)

        await claimAndSettle()
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Passkey verification wasn’t completed. Try again when ready.'
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        await claimAndSettle()
        expect(screen.getByRole('dialog')).toHaveTextContent('PasskeyNotSaved')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('counts a native 1001 cancel the same way and retries from the drawer', async () => {
        mockHandleRegister.mockRejectedValue(
            cancel(
                'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)'
            )
        )
        renderWithIntl(<Harness />)
        await claimAndSettle()
        await claimAndSettle()
        expect(screen.getByRole('dialog')).toHaveTextContent('PasskeyNotSaved')

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        await waitFor(() => expect(mockHandleRegister).toHaveBeenCalledTimes(3))
        expect(await screen.findByRole('dialog')).toHaveTextContent('PasskeyNotSaved')
    })

    it('opens the iCloud help on the first cancel when the sheet closed in under 2 s', async () => {
        mockCeremony = { durationMs: 1500 }
        mockHandleRegister.mockRejectedValue(cancel())
        renderWithIntl(<Harness />)
        await claimAndSettle()
        expect(screen.getByRole('dialog')).toHaveTextContent('PasskeyNotSaved')
        const [[, properties]] = failedEvents()
        expect(properties).toMatchObject({ ceremony_ms: 1500, attempt: 1, native_reason: undefined })
    })

    it('keeps the two-cancel rule when the sheet stayed open for a while', async () => {
        mockCeremony = { durationMs: 3000 }
        mockHandleRegister.mockRejectedValue(cancel())
        renderWithIntl(<Harness />)
        await claimAndSettle()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('wasn’t completed')
    })

    it('does not count failures with a specific native reason', async () => {
        mockHandleRegister.mockRejectedValue(
            cancel('The operation couldn’t be completed. Device must be unlocked to perform request.')
        )
        renderWithIntl(<Harness />)
        await claimAndSettle()
        await claimAndSettle()
        expect(screen.getByRole('alert')).toHaveTextContent('Unlock the device, then try again.')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it.each([
        ['iPhone Safari', 'ios'],
        ['Android', 'android'],
    ])('leaves %s cancels inline however often they repeat', async (_, deviceType) => {
        mockDeviceType = deviceType
        mockIOSNativeBridge = false
        mockHandleRegister.mockRejectedValue(cancel())
        renderWithIntl(<Harness />)
        await claimAndSettle()
        await claimAndSettle()
        await claimAndSettle()
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Passkey verification wasn’t completed. Try again when ready.'
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})

/*
 * TASK-24017: the plugin reports an Android phone that cannot create a passkey
 * (no screen lock, no Google account, no credential provider) with the same
 * NotAllowedError name as a dismissal, and a provider crash with no name at all.
 */
describe('Android failures that are not cancels', () => {
    // TASK-24498: the facts the refusal carries, keys only, never the challenge or the origin.
    const providerRefusal = () =>
        Object.assign(new Error('Unsupported passkey provider'), {
            name: 'PasskeyProviderUnsupportedError',
            code: 'PASSKEY_PROVIDER_UNSUPPORTED',
            challengeOffset: 41,
            clientDataKeys: ['androidPackageName', 'challenge', 'origin', 'type'],
            backupEligible: false,
        })

    it('opens the unsupported-provider drawer without signup completion or a generic help drawer', async () => {
        mockAndroidNativeBridge = true
        mockHandleRegister.mockRejectedValue(providerRefusal())
        const view = renderWithIntl(<Harness />)
        claim()
        expect(await screen.findByRole('dialog', { name: 'Unsupported passkey provider' })).toHaveAttribute(
            'data-platform',
            'android-app'
        )
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Claim' })).toBeEnabled()
        expect(failedEvents()).toEqual([
            [
                ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED,
                expect.objectContaining({
                    error_code: 'PASSKEY_PROVIDER_UNSUPPORTED',
                    challenge_offset: 41,
                    backup_eligible: false,
                    client_data_keys: ['androidPackageName', 'challenge', 'origin', 'type'],
                }),
            ],
        ])
        // One constant message, so every such phone groups into one Sentry issue.
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'Passkey provider writes an unsupported clientDataJSON layout',
            {
                level: 'warning',
                tags: { error_type: 'passkey_provider_unsupported', challenge_offset: 41 },
                extra: { clientDataKeys: ['androidPackageName', 'challenge', 'origin', 'type'], backupEligible: false },
            }
        )
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
        // A delayed address must not turn this rejected attempt into a completed signup.
        mockAddress = '0xlate-after-incompatible-provider'
        view.rerender(<Harness />)
        expect(mockNext).not.toHaveBeenCalled()
        expect(mockSetNoBackLock).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_PASSKEY_SUCCEEDED, expect.anything())
    })

    it('retries from the unsupported-provider drawer with one more ceremony', async () => {
        mockHandleRegister.mockRejectedValue(providerRefusal())
        renderWithIntl(<Harness />)
        claim()
        fireEvent.click(await screen.findByRole('button', { name: 'Retry with another provider' }))

        await waitFor(() => expect(mockHandleRegister).toHaveBeenCalledTimes(2))
        expect(failedEvents()).toHaveLength(2)
    })

    it('guides an API refusal outside the Android app with the iOS and web drawer', async () => {
        mockHandleRegister.mockRejectedValue(
            Object.assign(new Error('Unsupported passkey provider'), {
                name: 'PasskeyProviderUnsupportedError',
                code: 'PASSKEY_PROVIDER_UNSUPPORTED',
            })
        )
        renderWithIntl(<Harness />)
        claim()

        expect(await screen.findByRole('dialog', { name: 'Unsupported passkey provider' })).toHaveAttribute(
            'data-platform',
            'other'
        )
    })

    it('keeps the drawer open with the error when the browser does not open', async () => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => {
            throw new Error('No Activity found to handle Intent')
        })
        try {
            mockAndroidNativeBridge = true
            mockHandleRegister.mockRejectedValue(providerRefusal())
            renderWithIntl(<Harness />)
            claim()
            fireEvent.click(await screen.findByRole('button', { name: 'Sign up in a browser' }))

            expect(await screen.findByText('The browser did not open')).toBeInTheDocument()
            expect(screen.getByRole('dialog', { name: 'Unsupported passkey provider' })).toBeInTheDocument()
            expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
                tags: { error_type: 'passkey_provider_browser_open_failed' },
            })

            // A second tap that works closes the drawer and clears the error.
            open.mockReturnValue(window)
            fireEvent.click(screen.getByRole('button', { name: 'Sign up in a browser' }))
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        } finally {
            open.mockRestore()
        }
    })

    it('opens web signup with the keep-web hatch in the browser, where the browser writes the signed note', async () => {
        const open = jest.spyOn(window, 'open').mockReturnValue(window)
        try {
            mockAndroidNativeBridge = true
            mockHandleRegister.mockRejectedValue(providerRefusal())
            renderWithIntl(<Harness />)
            claim()
            fireEvent.click(await screen.findByRole('button', { name: 'Sign up in a browser' }))

            await waitFor(() =>
                expect(open).toHaveBeenCalledWith(
                    expect.stringMatching(/\/setup\?keep-web=walnut-still-cracks$/),
                    '_blank'
                )
            )
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
            expect(mockHandleRegister).toHaveBeenCalledTimes(1)
        } finally {
            open.mockRestore()
        }
    })

    it('opens the Android help drawer on the first "no create options" failure', async () => {
        mockHandleRegister.mockRejectedValue(
            Object.assign(new Error('No create options available.'), { name: 'NotAllowedError' })
        )
        renderWithIntl(<Harness />)
        claim()
        expect(await screen.findByRole('dialog')).toHaveTextContent('NotAllowedError')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        const [[, properties]] = failedEvents()
        expect(properties).toMatchObject({ native_reason: 'setup_required', attempt: 1 })
        // the bounded diagnostic, not the generic passkey_setup_error exception
        expect(Sentry.captureException).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ tags: expect.objectContaining({ passkey_reason: 'setup_required' }) })
        )
    })

    it('shows the interrupted message for a credential-provider failure', async () => {
        mockHandleRegister.mockRejectedValue(new Error('Unsuccessful result from folsom activity.'))
        renderWithIntl(<Harness />)
        claim()
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Something interrupted the passkey prompt. Please try again.'
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        const [[, properties]] = failedEvents()
        expect(properties).toMatchObject({ native_reason: 'provider_failed', error_code: 'PASSKEY_INTERRUPTED' })
    })

    it('reports a passkey-server error body as unreachable servers, not a device problem', async () => {
        mockHandleRegister.mockRejectedValue(
            Object.assign(new Error('Passkey server request failed'), { name: 'PasskeyServerError' })
        )
        renderWithIntl(<Harness />)
        claim()
        expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t reach Peanut’s servers.')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(Sentry.captureException).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ tags: { error_type: 'passkey_server_failure' } })
        )
    })

    it('counts attempts across retries on the same step', async () => {
        mockHandleRegister.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))
        renderWithIntl(<Harness />)
        claim()
        await waitFor(() => expect(failedEvents()).toHaveLength(1))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Claim' })).toBeEnabled())
        claim()
        await waitFor(() => expect(failedEvents()).toHaveLength(2))
        expect(failedEvents().map(([, properties]) => properties.attempt)).toEqual([1, 2])
    })
})

it('shows still-open guidance, without a retry drawer, when native still holds the old request', async () => {
    mockHandleRegister.mockRejectedValue(
        Object.assign(new Error('Passkey cleanup is unconfirmed'), { name: 'PasskeyCleanupPendingError' })
    )
    renderWithIntl(<Harness />)
    claim()
    expect(await screen.findByRole('alert')).toHaveTextContent(
        'The last passkey request is still open on this phone. Close any passkey window and try again.'
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockNext).not.toHaveBeenCalled()
})

it('asks for a short wait when the previous passkey request is still closing', async () => {
    mockHandleRegister.mockRejectedValue(
        Object.assign(new Error('A previous passkey flow is still pending'), { name: 'PasskeyRequestSettlingError' })
    )
    renderWithIntl(<Harness />)
    claim()
    expect(await screen.findByRole('alert')).toHaveTextContent(
        'The last passkey prompt is still closing. Wait a few seconds and try again.'
    )
    expect(mockNext).not.toHaveBeenCalled()
})

it('protects navigation before asynchronous preflight settles and releases it on refusal', async () => {
    let resolve!: (value: { isSupported: boolean; warning?: string }) => void
    mockSupport.mockReturnValue(
        new Promise((done) => {
            resolve = done
        })
    )
    renderWithIntl(<Harness />)
    claim()
    expect(mockSetRegistrationInProgress).toHaveBeenCalledWith(true)
    resolve({ isSupported: false })
    await waitFor(() => expect(mockSetRegistrationInProgress).toHaveBeenLastCalledWith(false))
    expect(mockHandleRegister).not.toHaveBeenCalled()
})

it('does not call an unknown collision lookup an available username', async () => {
    mockApiFetch.mockResolvedValueOnce({ status: 404 }).mockResolvedValue({ status: 503 })
    mockHandleRegister.mockRejectedValue(Object.assign(new Error('taken'), { name: 'UsernameTaken' }))
    renderWithIntl(<Harness />)
    claim()
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t reach Peanut’s servers')
    expect(mockSetScreenId).not.toHaveBeenCalled()
    expect(mockHandleRegister).toHaveBeenCalledTimes(1)
})

it('does not repeat an uncertain registration while the reconciliation lookup is unavailable', async () => {
    mockApiFetch.mockResolvedValueOnce({ status: 404 }).mockResolvedValue({ status: 503 })
    mockHandleRegister.mockRejectedValue(new Error('Session hydration failed'))
    renderWithIntl(<Harness />)
    claim()
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t reach Peanut’s servers')
    expect(mockHandleRegister).toHaveBeenCalledTimes(1)
})
