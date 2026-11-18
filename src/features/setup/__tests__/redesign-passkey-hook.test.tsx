/** @jest-environment jsdom */
/*
 * 03 Passkey: the additive useSignupPasskey fields of build/contract/C.md § 4.8 (C-39, C-40, C-41).
 * Mocks follow useSignupPasskey.test.tsx. The two new fields are read through a widened type so this suite compiles
 * before the hook has them; until then the C-40/C-41 cases fail on their values.
 */
import posthog from 'posthog-js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen } from '@/test-utils/signup-controls'
import { type PasskeyHelpReason, useSignupPasskey } from '../useSignupPasskey'

let mockHandleRegister = jest.fn()
const mockApiFetch = jest.fn()
let mockIOSNativeBridge = false
let mockCeremony: { durationMs: number } | undefined

jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleRegister: mockHandleRegister, address: undefined, isRegistering: false }),
}))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: jest.fn(), isLoggingIn: false }) }))
jest.mock('@/hooks/useSetupFlow', () => ({
    postRegistrationScreen: () => 'notification-email',
    useSetupFlow: () => ({ isLoading: false, handleNext: jest.fn(), setScreenId: jest.fn() }),
}))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: 'android' }) }))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => false,
    isIOSNativeBridge: () => mockIOSNativeBridge,
    isAndroidNativeBridge: () => false,
}))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useOptionalSetupFlow: () => null,
    useSetupFlowContext: () => ({
        setNoBackLockScreenId: jest.fn(),
        registrationInProgress: false,
        setRegistrationInProgress: jest.fn(),
        setInviterAccepted: jest.fn(),
        setRefusedUsername: jest.fn(),
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
    useAuth: () => ({ user: { user: { userId: 'new-user', username: 'kimi' } }, fetchUser: jest.fn() }),
}))
jest.mock('@/features/setup/signup-draft', () => ({
    bindSignupDraft: jest.fn(async () => {}),
    saveSignupDraft: jest.fn(),
}))
jest.mock('@/services/pending-invite-attribution', () => ({ settlePendingInviteAttribution: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/passkeyPreflight', () => ({ checkPasskeySupport: async () => ({ isSupported: true }) }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    ...jest.requireActual('@/utils/webauthn-ceremony-telemetry'),
    latestCeremony: () => mockCeremony,
}))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

/** The hook as the redesign reads it: the two fields C adds next to dev's. */
type RedesignPasskey = ReturnType<typeof useSignupPasskey> & {
    inlineErrorCode?: 'cancelled' | null
    helpReason?: PasskeyHelpReason | null
}

function Probe() {
    const passkey = useSignupPasskey('kimi') as RedesignPasskey
    return (
        <div>
            <button disabled={passkey.isClaiming} onClick={() => void passkey.claim()}>
                Claim
            </button>
            <output
                data-testid="probe"
                data-inline-code={String(passkey.inlineErrorCode)}
                data-help-reason={String(passkey.helpReason)}
            >
                {passkey.inlineError}
            </output>
        </div>
    )
}
const renderProbe = () => renderWithIntl(onSignupScreen('passkey', <Probe />))
const probe = () => screen.getByTestId('probe')
const failures = () =>
    (posthog.capture as jest.Mock).mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED)
/** One tap that settles: the failure is reported and the button is free again. */
const claimAndSettle = async () => {
    const before = failures().length
    fireEvent.click(screen.getByRole('button', { name: 'Claim' }))
    await waitFor(() => expect(failures()).toHaveLength(before + 1), { timeout: 5000 })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Claim' })).toBeEnabled())
}
const failWith = (name: string, message = 'failed') => Object.assign(new Error(message), { name })

beforeEach(() => {
    jest.clearAllMocks()
    mockIOSNativeBridge = false
    mockCeremony = undefined
    mockApiFetch.mockResolvedValue({ status: 404 })
    mockHandleRegister = jest.fn(() => new Promise(() => {}))
})

describe('C-39 one tap, one registration', () => {
    it('C-39 two taps during the pre-ceremony checks start one lookup and no second registration', async () => {
        mockApiFetch.mockImplementation(() => new Promise(() => {}))
        renderProbe()
        fireEvent.click(screen.getByRole('button', { name: 'Claim' }))
        fireEvent.click(screen.getByRole('button', { name: 'Claim' }))
        await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
        expect(screen.getByRole('button', { name: 'Claim' })).toBeDisabled()
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })
})

describe('C-40 inlineErrorCode', () => {
    it('C-40 a plain NotAllowedError in a browser (not private mode) is cancelled, with the cancel line', async () => {
        mockHandleRegister.mockRejectedValue(failWith('NotAllowedError', 'cancelled'))
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-inline-code', 'cancelled')
        expect(probe()).toHaveTextContent('Passkey setup was cancelled. Try again when ready.')
    })

    it('C-40 the first slow native cancel (1001) in the iOS app is cancelled', async () => {
        mockIOSNativeBridge = true
        mockCeremony = { durationMs: 3000 }
        mockHandleRegister.mockRejectedValue(
            failWith(
                'NotAllowedError',
                'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)'
            )
        )
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-inline-code', 'cancelled')
        expect(probe()).toHaveAttribute('data-help-reason', 'null')
    })

    it('C-40 TASK-25047 an unclassified NotAllowedError in the iOS app is not completed, not cancelled', async () => {
        mockIOSNativeBridge = true
        mockCeremony = { durationMs: 3000 }
        mockHandleRegister.mockRejectedValue(failWith('NotAllowedError', 'cancelled'))
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-inline-code', 'null')
        expect(probe()).toHaveTextContent('Passkey verification wasn’t completed. Try again when ready.')
    })

    it('C-40 a native cancel reason (LOGIN_CANCELED) outside the iOS app is cancelled', async () => {
        mockHandleRegister.mockRejectedValue(failWith('NotAllowedError', 'User cancelled the selector'))
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-inline-code', 'cancelled')
        expect(probe().textContent).not.toBe('')
    })

    it.each([
        ['PasskeyRateLimitedError', 'Too many attempts. Wait a bit and try again.'],
        ['PasskeyServerError', 'Couldn’t reach Peanut’s servers. Check your connection and try again.'],
    ])('C-40 %s is an inline error that is not a cancel (null), text as dev', async (name, text) => {
        mockHandleRegister.mockRejectedValue(failWith(name))
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveTextContent(text)
        expect(probe()).toHaveAttribute('data-inline-code', 'null')
    })

    it('C-40 a new tap clears cancelled back to null', async () => {
        mockHandleRegister.mockRejectedValueOnce(failWith('NotAllowedError', 'cancelled'))
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-inline-code', 'cancelled')
        fireEvent.click(screen.getByRole('button', { name: 'Claim' }))
        await waitFor(() => expect(probe()).toHaveAttribute('data-inline-code', 'null'))
        expect(probe()).toHaveTextContent('')
    })
})

describe('C-41 helpReason', () => {
    it('C-41 a native setup_required failure is android-setup', async () => {
        mockHandleRegister.mockRejectedValue(failWith('NotAllowedError', 'No create options available.'))
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-help-reason', 'android-setup')
    })

    it('C-41 the second iOS-app cancel is ios-not-saved', async () => {
        mockIOSNativeBridge = true
        mockCeremony = { durationMs: 3000 }
        mockHandleRegister.mockRejectedValue(failWith('NotAllowedError', 'cancelled'))
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-help-reason', 'null')
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-help-reason', 'ios-not-saved')
    })

    it('C-41 an iOS-app cancel under 2000 ms is ios-not-saved at once', async () => {
        mockIOSNativeBridge = true
        mockCeremony = { durationMs: 1500 }
        mockHandleRegister.mockRejectedValue(failWith('NotAllowedError', 'cancelled'))
        renderProbe()
        await claimAndSettle()
        expect(probe()).toHaveAttribute('data-help-reason', 'ios-not-saved')
    })

    it('C-41 NotAllowedError in private mode is private-mode', async () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        try {
            mockHandleRegister.mockRejectedValue(failWith('NotAllowedError', 'blocked'))
            renderProbe()
            await claimAndSettle()
            expect(probe()).toHaveAttribute('data-help-reason', 'private-mode')
        } finally {
            setItem.mockRestore()
        }
    })

    it.each(['NotReadableError', 'InvalidStateError', 'NotSupportedError', 'SomethingUnknownError'])(
        'C-41 %s is error-name',
        async (name) => {
            mockHandleRegister.mockRejectedValue(failWith(name))
            renderProbe()
            await claimAndSettle()
            await waitFor(() => expect(probe()).toHaveAttribute('data-help-reason', 'error-name'), { timeout: 5000 })
        },
        // NotReadableError goes through withWebAuthnRetry's backoff first
        15_000
    )
})
