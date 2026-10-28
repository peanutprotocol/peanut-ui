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
const mockNext = jest.fn()
let mockHandleNext = mockNext
let mockDeviceType = 'android'
let mockIOSNativeBridge = false
// The OS sheet's own duration for the attempt, as the telemetry wrapper records it.
let mockCeremony: { durationMs: number } | undefined

jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleRegister: mockHandleRegister, address: mockAddress, isRegistering: mockIsRegistering }),
}))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: false }) }))
jest.mock('@/hooks/useSetupFlow', () => ({
    postRegistrationScreen: () => 'residence',
    useSetupFlow: () => ({ isLoading: false, handleNext: mockHandleNext }),
}))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: mockDeviceType }) }))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isIOSNativeBridge: () => mockIOSNativeBridge,
}))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({ setNoBackLockScreenId: mockSetNoBackLock, steps: [] }),
}))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/passkeyPreflight', () => ({ checkPasskeySupport: () => mockSupport() }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({ latestCeremony: () => mockCeremony }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

/** The username step's use of the hook, without the form: Claim, the messages, Log in, the help drawer state. */
function Harness() {
    const passkey = useSignupPasskey('kim')
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
    mockCeremony = undefined
    mockSupport.mockImplementation(async () => ({ isSupported: true }))
    // 404 = username free, so the handler proceeds to registration
    mockApiFetch.mockResolvedValue({ status: 404 })
    mockHandleRegister = jest.fn(() => new Promise(() => {}))
})

describe('useSignupPasskey — one tap, one ceremony', () => {
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
        expect(mockHandleRegister).toHaveBeenCalledWith('kim')
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
    it('advances exactly once, to residence, and locks the way back when the address appears', async () => {
        mockHandleRegister.mockResolvedValue(undefined)
        const view = renderWithIntl(<Harness />)
        claim()
        await waitFor(() => expect(mockHandleRegister).toHaveBeenCalledTimes(1))
        expect(mockNext).not.toHaveBeenCalled()
        mockAddress = '0x1234'
        view.rerender(<Harness />)
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSetNoBackLock).toHaveBeenCalledWith('residence')
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

describe('failures keep the user on the username step', () => {
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

    it('shows a curated message when Log in itself fails', async () => {
        mockApiFetch.mockResolvedValue({ status: 200 })
        mockLogin.mockRejectedValueOnce(new Error('Login exploded'))
        renderWithIntl(<Harness />)
        claim()
        fireEvent.click(await screen.findByRole('button', { name: 'Log in' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Login exploded')
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

it('shows restart guidance, without a retry drawer, when native cleanup is unconfirmed', async () => {
    mockHandleRegister.mockRejectedValue(
        Object.assign(new Error('A previous passkey flow is still pending'), { name: 'PasskeyCleanupPendingError' })
    )
    renderWithIntl(<Harness />)
    claim()
    expect(await screen.findByRole('alert')).toHaveTextContent('Restart the app and try again.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockNext).not.toHaveBeenCalled()
})
