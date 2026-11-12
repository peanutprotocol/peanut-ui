jest.mock('@/services/signup-geo', () => ({ attachSignupGeo: jest.fn() }))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import es from '@/i18n/app/messages/es-419.json'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import { getRedirectUrl, setRedirectUrl } from '@/utils/general.utils'
import SignTestTransaction from '../SignTestTransaction'
import CompleteSignupStep from '../CompleteSignup'
import { capturePasskeyDebugInfo } from '@/utils/passkeyDebug'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { AccountSetupError } from '@/services/account-setup'
import { AccountType } from '@/interfaces/interfaces'
import { confettiPresets } from '@/utils/confetti'
import { recordSetupIpCountry } from '@/features/setup/country-signals'
import { CeremonyTimeoutError } from '@/utils/passkeyCeremony.utils'
import { SignupTestTxError } from '@/features/setup/signup-test-tx-error'
import { UserOpSubmissionError } from '@/utils/userop-submission'
import {
    readSignupTestTransaction,
    saveSignupTestTransaction,
    type SignupTestTransaction,
} from '@/features/setup/signup-test-transaction'

const WALLET = '0x1111111111111111111111111111111111111111'

const mockRouterPush = jest.fn()
const mockRouterReplace = jest.fn()
const mockAddAccount = jest.fn()
const mockSendUserOp = jest.fn()
const mockReadSignupAttributionAsync = jest.fn()
const mockClearSignupAttribution = jest.fn()
const mockHasPendingSignupAttribution = jest.fn()
const mockLogoutUser = jest.fn()
const mockLatestCeremony = jest.fn()

let mockSignupCompleted = false
let mockFundingChannel: string | undefined
let mockPaymentChannel: string | undefined

let accounts: Array<{ type: AccountType }> = []

// useAccountSetup is deliberately NOT mocked: the bug this locks down was a
// router navigation inside finalizeAccountSetup, which no component-level mock
// of that hook could ever catch. The terminal leg replaces (never pushes) so
// hardware back from /home cannot land on a finished setup.
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
    useSearchParams: () => ({ get: () => null }),
}))

jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ address: WALLET }),
}))

jest.mock('@/features/setup/useSignupTestTransaction', () => ({
    useSignupTestTransaction: () => ({ sendTestTransaction: mockSendUserOp }),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'user-1', username: 'kim' }, accounts },
        isFetchingUser: false,
        fetchUser: jest.fn(),
        addAccount: mockAddAccount,
        logoutUser: mockLogoutUser,
        isLoggingOut: false,
    }),
}))

jest.mock('@/features/setup/SetupFlowContext', () => ({
    useOptionalSetupFlow: () => null,
    useSetupFlowContext: () => ({
        signupCompleted: mockSignupCompleted,
        fundingChannel: mockFundingChannel,
        paymentChannel: mockPaymentChannel,
        residenceCountry: '',
        secondResidenceCountry: '',
        setIsLoading: jest.fn(),
        steps: [{ screenId: 'signup' }, { screenId: 'passkey-permission' }, { screenId: 'sign-test-transaction' }],
        signupEntryFlow: 'default',
    }),
}))

jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <div data-testid="celebration-mascot" />,
}))
jest.mock('@/utils/confetti', () => ({ confettiPresets: { celebration: jest.fn(), success: jest.fn() } }))
jest.mock('@/utils/auth.utils', () => ({ clearAuthState: jest.fn() }))
jest.mock('@/utils/signup-attribution', () => ({
    readSignupAttributionAsync: (...args: unknown[]) => mockReadSignupAttributionAsync(...args),
    clearSignupAttribution: (...args: unknown[]) => mockClearSignupAttribution(...args),
    hasPendingSignupAttribution: (...args: unknown[]) => mockHasPendingSignupAttribution(...args),
}))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    ...jest.requireActual('@/utils/webauthn-ceremony-telemetry'),
    latestCeremony: (...args: unknown[]) => mockLatestCeremony(...args),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: jest.fn(),
        setPersonProperties: jest.fn(),
    },
}))

describe('SignTestTransaction — setup completion', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
        accounts = []
        mockSignupCompleted = false
        mockFundingChannel = undefined
        mockPaymentChannel = undefined
        mockSendUserOp.mockResolvedValue({ userOpHash: '0xhash' })
        mockReadSignupAttributionAsync.mockResolvedValue(null)
        mockClearSignupAttribution.mockResolvedValue(undefined)
        mockHasPendingSignupAttribution.mockResolvedValue(false)
        // addAccount refetches the user, so the account appears before the
        // completion redirect — the pre-existing-account effect must not race it.
        mockAddAccount.mockImplementation(async () => {
            accounts = [{ type: AccountType.PEANUT_WALLET }]
        })
    })

    it('offers log out as a link under the primary only where asked (/setup/finish)', () => {
        const { unmount } = renderWithIntl(<SignTestTransaction />)
        expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
        unmount()

        renderWithIntl(<SignTestTransaction showLogout />)
        fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
        expect(mockLogoutUser).toHaveBeenCalledTimes(1)
    })

    // The page shows the title and one line under it; the step itself adds no
    // text about how the passkey is checked (Release 164 smoke test).
    it('shows no text on /setup/finish besides the actions and the passkey link', () => {
        const { container } = renderWithIntl(<SignTestTransaction showLogout />)
        const shown = [en.setup.testTransaction.confirmAndFinish, en.profile.logOut, en.setup.passkey.learnMore]
        expect(shown.reduce((rest, text) => rest.replace(text, ''), container.textContent ?? '').trim()).toBe('')
    })

    it('the setup error follows a language change made after it appeared', async () => {
        mockSendUserOp.mockRejectedValueOnce(new Error('Signing failed'))
        jest.mocked(capturePasskeyDebugInfo).mockResolvedValueOnce(undefined as never)
        const inLocale = (locale: 'en' | 'es-419', messages: typeof en) => (
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <SignTestTransaction />
            </NextIntlClientProvider>
        )
        const { rerender } = render(inLocale('en', en))
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() =>
            expect(
                screen.getByText(en.setup.testTransaction.errors.supportNeeded, { exact: false })
            ).toBeInTheDocument()
        )

        rerender(inLocale('es-419', es))
        expect(screen.getByText(es.setup.testTransaction.errors.supportNeeded, { exact: false })).toBeInTheDocument()
        expect(
            screen.queryByText(en.setup.testTransaction.errors.supportNeeded, { exact: false })
        ).not.toBeInTheDocument()
    })

    it('releases the confirm button when signing fails even if diagnostics never finish', async () => {
        mockSendUserOp.mockRejectedValueOnce(new Error('Signing failed'))
        jest.mocked(capturePasskeyDebugInfo).mockReturnValueOnce(new Promise(() => {}))
        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(capturePasskeyDebugInfo).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled())
        expect(mockAddAccount).not.toHaveBeenCalled()
        expect(confettiPresets.celebration).not.toHaveBeenCalled()
    })

    it('redirects when Retry discovers an account from the ambiguous request', async () => {
        mockAddAccount.mockRejectedValueOnce(
            new AccountSetupError('Account creation could not be confirmed', {
                kind: 'retryable',
                requestAttempts: 2,
                status: 503,
            })
        )
        const { rerender } = renderWithIntl(<SignTestTransaction />)

        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(screen.getByRole('button', { name: /retry account setup/i })).toBeEnabled())
        expect(confettiPresets.celebration).not.toHaveBeenCalled()

        // A later focus/profile refresh reveals that the first request did
        // commit. The Retry action must consume the signup marker and finish.
        accounts = [{ type: AccountType.PEANUT_WALLET }]
        rerender(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /retry account setup/i }))

        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/home'))
        expect(mockAddAccount).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(confettiPresets.celebration).toHaveBeenCalledTimes(1)
    })

    it('saves the current choices when Retry discovers a wallet from an ambiguous request', async () => {
        mockFundingChannel = 'brlBank'
        mockPaymentChannel = 'qr'
        mockAddAccount.mockRejectedValueOnce(
            new AccountSetupError('Account creation could not be confirmed', {
                kind: 'retryable',
                requestAttempts: 2,
                status: 503,
            })
        )
        const { rerender } = renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(screen.getByRole('button', { name: /retry account setup/i })).toBeEnabled())

        accounts = [{ type: AccountType.PEANUT_WALLET }]
        mockPaymentChannel = 'card'
        rerender(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /retry account setup/i }))

        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/home'))
        expect(mockAddAccount).toHaveBeenCalledTimes(2)
        expect(mockAddAccount).toHaveBeenLastCalledWith(
            expect.objectContaining({ signupPreferences: { fundingChannel: 'brlBank', paymentChannel: 'card' } })
        )
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
    })

    it('redirects immediately after account finalization', async () => {
        renderWithIntl(<SignTestTransaction />)

        const confirmButton = screen.getByRole('button', { name: /confirm/i })
        fireEvent.click(confirmButton)

        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/home'))
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(confettiPresets.celebration).toHaveBeenCalledTimes(1)
        expect(confirmButton).toBeDisabled()
        fireEvent.click(confirmButton)
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
        expect(screen.queryByText(/works right now/i)).not.toBeInTheDocument()
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_COMPLETED,
            expect.objectContaining({ flow_version: 2, signup_entry_flow: 'default' })
        )
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('hands successful signup to celebration without consuming the saved destination', async () => {
        const onComplete = jest.fn()
        setRedirectUrl('/receipt?id=abc')
        renderWithIntl(<SignTestTransaction onComplete={onComplete} />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(mockRouterReplace).not.toHaveBeenCalled()
        expect(getRedirectUrl()).toBe('/receipt?id=abc')
        expect(confettiPresets.celebration).not.toHaveBeenCalled()
    })

    it('requires confirmation when unfinished signup already has a saved wallet', async () => {
        accounts = [{ type: AccountType.PEANUT_WALLET }]
        mockFundingChannel = 'bank'
        mockPaymentChannel = 'card'
        const onComplete = jest.fn()
        setRedirectUrl('/receipt?id=abc')
        renderWithIntl(<SignTestTransaction merged onComplete={onComplete} />)

        expect(mockRouterReplace).not.toHaveBeenCalled()
        expect(mockSendUserOp).not.toHaveBeenCalled()
        expect(onComplete).not.toHaveBeenCalled()

        let finishSigning!: (result: { userOpHash: string }) => void
        mockSendUserOp.mockReturnValueOnce(new Promise((resolve) => (finishSigning = resolve)))
        // "You are in charge": the shared title block on top, the passkey confirmation on Finish
        expect(screen.getByRole('heading', { level: 1, name: "You're in charge" })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
        expect(mockAddAccount).not.toHaveBeenCalled()
        expect(onComplete).not.toHaveBeenCalled()

        await act(async () => finishSigning({ userOpHash: '0xhash' }))
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(mockAddAccount).toHaveBeenCalledWith(
            expect.objectContaining({ signupPreferences: { fundingChannel: 'bank', paymentChannel: 'card' } })
        )
        expect(mockRouterReplace).not.toHaveBeenCalled()
        expect(getRedirectUrl()).toBe('/receipt?id=abc')
    })

    it('still redirects an existing account on the legacy login finish route without signing', () => {
        accounts = [{ type: AccountType.PEANUT_WALLET }]
        const { rerender } = renderWithIntl(<SignTestTransaction />)
        rerender(<SignTestTransaction />)
        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(mockSendUserOp).not.toHaveBeenCalled()
        expect(mockAddAccount).not.toHaveBeenCalled()
    })

    it('retries saving signup after a backend failure without repeating successful signing', async () => {
        const onComplete = jest.fn()
        mockFundingChannel = 'bank'
        mockPaymentChannel = 'card'
        mockAddAccount.mockRejectedValueOnce(
            new AccountSetupError('Account creation could not be confirmed', {
                kind: 'retryable',
                requestAttempts: 2,
                status: 503,
            })
        )
        const { rerender } = renderWithIntl(<SignTestTransaction onComplete={onComplete} />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(screen.getByRole('button', { name: /retry account setup/i })).toBeEnabled())
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
        expect(onComplete).not.toHaveBeenCalled()

        accounts = [{ type: AccountType.PEANUT_WALLET }]
        rerender(<SignTestTransaction onComplete={onComplete} />)
        expect(mockRouterReplace).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: /retry account setup/i }))
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(mockAddAccount).toHaveBeenCalledTimes(2)
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('attaches independently captured country hints to completion and the identified profile', async () => {
        recordSetupIpCountry('BR')
        const onComplete = jest.fn()
        renderWithIntl(<SignTestTransaction onComplete={onComplete} />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_COMPLETED,
            expect.objectContaining({ signup_ip_country: 'BR' })
        )
        expect(posthog.setPersonProperties).toHaveBeenCalledWith(expect.objectContaining({ signup_ip_country: 'BR' }))
        recordSetupIpCountry(null)
    })

    it('changes the final confirmation into one celebration and preserves its destination through the celebration', async () => {
        const onComplete = jest.fn(() => {
            mockSignupCompleted = true
        })
        setRedirectUrl('/receipt?id=abc')
        const view = renderWithIntl(<CompleteSignupStep onComplete={onComplete} />)
        expect(screen.getByRole('heading', { name: "You're in charge" })).toBeInTheDocument()
        expect(
            screen.getByText(
                'Only you can use your fingerprint or Face ID to control your account. Peanut can never move or freeze your money. Try it now.'
            )
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        jest.useFakeTimers()
        view.rerender(<CompleteSignupStep onComplete={onComplete} />)
        expect(screen.queryByRole('heading', { name: "You're in charge" })).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'All set!' })).toBeInTheDocument()
        expect(screen.getByText('Your Peanut account is ready.')).toBeInTheDocument()
        expect(screen.queryByText('Works right now')).not.toBeInTheDocument()
        expect(mockRouterReplace).not.toHaveBeenCalled()
        expect(confettiPresets.celebration).not.toHaveBeenCalled()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        act(() => jest.advanceTimersByTime(5000))
        jest.useRealTimers()
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(mockRouterReplace).toHaveBeenCalledWith('/receipt?id=abc')
    })

    it('captures a Preferences-only journey after restart before clearing its native context', async () => {
        const order: string[] = []
        mockReadSignupAttributionAsync.mockResolvedValue({
            journeyId: '33333333-3333-4333-8333-333333333333',
            platform: 'android',
            captureMethod: 'browser',
        })
        jest.mocked(posthog.capture).mockImplementation((event) => {
            if (event === ANALYTICS_EVENTS.SIGNUP_COMPLETED) order.push('capture')
            return undefined
        })
        mockClearSignupAttribution.mockImplementation(async () => {
            order.push('clear')
        })

        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/home'))
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_COMPLETED,
            expect.objectContaining({
                signup_journey_id: '33333333-3333-4333-8333-333333333333',
                signup_platform: 'android',
            })
        )
        expect(order).toEqual(['capture', 'clear'])
    })

    it('preserves unacknowledged attribution for an authenticated retry after completion', async () => {
        mockHasPendingSignupAttribution.mockResolvedValue(true)
        mockReadSignupAttributionAsync.mockResolvedValue({
            journeyId: '33333333-3333-4333-8333-333333333333',
            platform: 'android',
            captureMethod: 'browser',
        })
        const onComplete = jest.fn()
        renderWithIntl(<SignTestTransaction onComplete={onComplete} />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_COMPLETED,
            expect.objectContaining({ signup_journey_id: '33333333-3333-4333-8333-333333333333' })
        )
        expect(mockClearSignupAttribution).not.toHaveBeenCalled()
    })

    /*
     * Signup completion declares the account new, switching on the cross-account
     * guard. Without a classified
     * record in the fixture the flag is unobserved — the argument could be
     * deleted with every test here still green, and logout-from-/profile then
     * signup would land on /profile again.
     */
    const completeSignup = async () => {
        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled())
    }

    it('refuses a page the previous session was standing on', async () => {
        setRedirectUrl('/profile', 'session-end')

        await completeSignup()

        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        expect(getRedirectUrl()).toBeNull()
    })

    it('still takes a deep link the person asked for', async () => {
        setRedirectUrl('/receipt?id=abc')

        await completeSignup()

        expect(mockRouterReplace).toHaveBeenCalledWith('/receipt?id=abc')
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
    })

    // TASK-23931: only an unknown failure asks the person to contact support
    describe('classifies a Confirm & finish failure', () => {
        beforeEach(() => {
            jest.mocked(capturePasskeyDebugInfo).mockResolvedValue(undefined as never)
            mockLatestCeremony.mockReturnValue({ challengeOffset: 41, backupEligible: false })
        })

        const failConfirmWith = async (error: unknown, copy: string) => {
            mockSendUserOp.mockRejectedValueOnce(error)
            renderWithIntl(<SignTestTransaction />)
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
            await waitFor(() => expect(screen.getByText(copy, { exact: false })).toBeInTheDocument())
            const failures = jest
                .mocked(posthog.capture)
                .mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_TEST_TX_FAILED)
            expect(failures).toHaveLength(1)
            return failures[0][1]
        }
        const expectNoSupportCopy = () =>
            expect(
                screen.queryByText(en.setup.testTransaction.errors.supportNeeded, { exact: false })
            ).not.toBeInTheDocument()

        it('shows the passkey copy for a cancel', async () => {
            const cancel = Object.assign(new Error('The operation either timed out or was not allowed.'), {
                name: 'NotAllowedError',
            })
            const event = await failConfirmWith(cancel, en.setup.passkey.notCompleted)
            expectNoSupportCopy()
            expect(event).toMatchObject({ error_name: 'NotAllowedError', error_code: 'LOGIN_CANCELED', is_aa24: false })
        })

        it('reads the Android shim cancel as a cancel', async () => {
            const event = await failConfirmWith(new Error('User cancelled the selector'), en.setup.passkey.notCompleted)
            expectNoSupportCopy()
            expect(event).toMatchObject({ error_name: 'NotAllowedError', error_code: 'LOGIN_CANCELED' })
        })

        it('shows the timeout copy for a ceremony that never settled', async () => {
            const event = await failConfirmWith(new CeremonyTimeoutError(60_000), en.setup.passkey.tookTooLong)
            expectNoSupportCopy()
            expect(event).toMatchObject({ error_name: 'CeremonyTimeoutError', error_code: 'CEREMONY_TIMEOUT' })
        })

        it('names the password manager on AA24 and sends the assertion layout', async () => {
            // viem repeats the bundler's details line on the inner error
            const details = 'Details: UserOperation reverted with reason: AA24 signature error'
            const signatureError = Object.assign(
                new Error(`Signature provided for the User Operation is invalid.\n\n${details}`),
                { name: 'UserOperationSignatureError' }
            )
            const executionError = Object.assign(
                new Error(`Signature provided for the User Operation is invalid.\n\n${details}`, {
                    cause: signatureError,
                }),
                { name: 'UserOperationExecutionError' }
            )

            const event = await failConfirmWith(
                executionError,
                en.setup.testTransaction.errors.passkeyProviderUnsupported
            )

            expectNoSupportCopy()
            expect(event).toMatchObject({
                error_name: 'UserOperationSignatureError',
                error_code: undefined,
                is_aa24: true,
                failure_mode: 'signature_invalid',
                deferral_offered: false,
                backup_eligible: false,
                challenge_offset: 41,
            })
            expect(mockLatestCeremony).toHaveBeenCalledWith('get', 'user_op', expect.any(Number))
            await waitFor(() => expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled())
            expect(mockAddAccount).not.toHaveBeenCalled()
            expect(mockLogoutUser).not.toHaveBeenCalled()
        })

        it('shows retry copy, not support, for a server error whose hex request body contains aa24', async () => {
            const unrelated = Object.assign(
                new Error(
                    'HTTP request failed.\n\nStatus: 500\nRequest body: {"method":"pm_sponsorUserOperation","params":[{"callData":"0x51945447aa24f0"}]}'
                ),
                { name: 'HttpRequestError', status: 500 }
            )

            const event = await failConfirmWith(unrelated, en.setup.testTransaction.errors.networkBusy)
            expectNoSupportCopy()
            expect(
                screen.queryByText(en.setup.testTransaction.errors.passkeyProviderUnsupported, { exact: false })
            ).not.toBeInTheDocument()
            expect(event).toMatchObject({
                error_name: 'HttpRequestError',
                is_aa24: false,
                failure_mode: 'bundler_transient',
            })
        })

        it('keeps support copy for a failure no retry is known to fix', async () => {
            const event = await failConfirmWith(
                new SignupTestTxError('submit', new Error('AA21 didn’t pay prefund')),
                en.setup.testTransaction.errors.supportNeeded
            )
            expect(event).toMatchObject({ failure_mode: 'unknown', phase: 'submit' })
        })

        it('leaves a failed passkey prompt to the signing hook’s rate-limited report', async () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
            const closed = new SignupTestTxError(
                'sign',
                Object.assign(new Error('The operation either timed out or was not allowed.'), {
                    name: 'NotAllowedError',
                })
            )
            await failConfirmWith(closed, en.setup.passkey.notCompleted)
            expect(Sentry.captureException).not.toHaveBeenCalled()
            expect(consoleError).not.toHaveBeenCalled()
            consoleError.mockRestore()
        })

        it('still reports a signing failure the passkey reporter does not recognise', async () => {
            const broken = new SignupTestTxError(
                'sign',
                new TypeError("Cannot read properties of undefined (reading 'x')")
            )
            await failConfirmWith(broken, en.setup.passkey.interrupted)
            expect(Sentry.captureException).toHaveBeenCalledTimes(1)
            expect(Sentry.captureException).toHaveBeenCalledWith(
                broken,
                expect.objectContaining({ tags: { feature: 'signup-test-transaction', failure_mode: 'passkey' } })
            )
        })

        it('reports a submission failure once, with its tags, and never through console.error', async () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
            const failure = new SignupTestTxError('submit', new Error('AA21 didn’t pay prefund'))
            await failConfirmWith(failure, en.setup.testTransaction.errors.supportNeeded)
            expect(Sentry.captureException).toHaveBeenCalledTimes(1)
            expect(Sentry.captureException).toHaveBeenCalledWith(
                failure,
                expect.objectContaining({
                    tags: { feature: 'signup-test-transaction', failure_mode: 'unknown' },
                })
            )
            expect(consoleError).not.toHaveBeenCalled()
            consoleError.mockRestore()
        })

        it('shows retry copy for a passkey prompt that closed without a reason', async () => {
            const event = await failConfirmWith(
                new SignupTestTxError('sign', new Error('')),
                en.setup.passkey.interrupted
            )
            expectNoSupportCopy()
            expect(event).toMatchObject({ failure_mode: 'passkey', phase: 'sign', error_code: 'LOGIN_ERROR' })
        })

        it('shows retry copy after the bundler retries are exhausted', async () => {
            const stalled = new SignupTestTxError(
                'submit',
                new UserOpSubmissionError('transient', `0x${'ab'.repeat(32)}`, 3, true, new Error('timeout')),
                'valid'
            )
            const event = await failConfirmWith(stalled, en.setup.testTransaction.errors.networkBusy)
            expectNoSupportCopy()
            expect(event).toMatchObject({ failure_mode: 'bundler_transient', submission_kind: 'transient' })
            expect(screen.queryByRole('button', { name: en.setup.testTransaction.finishLater })).not.toBeInTheDocument()
        })
    })
})

describe('SignTestTransaction — finishing while the network is down', () => {
    const HASH = `0x${'ab'.repeat(32)}` as const
    const pending = (overrides: Partial<SignupTestTransaction> = {}): SignupTestTransaction => ({
        chainId: 42161,
        sender: WALLET,
        entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        userOpHash: HASH,
        userOperation: { sender: WALLET, nonce: '0x0', callData: '0x', signature: '0x01' } as never,
        signatureCheck: 'valid',
        signatureRejected: false,
        needsNewSignature: false,
        transientFailures: 2,
        mined: false,
        deferred: false,
        deferredRetries: 0,
        signedAt: Date.now(),
        ...overrides,
    })
    const stalled = () =>
        new SignupTestTxError(
            'submit',
            new UserOpSubmissionError('transient', HASH, 3, true, new Error('timeout')),
            'valid'
        )

    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
        accounts = []
        mockSignupCompleted = false
        mockReadSignupAttributionAsync.mockResolvedValue(null)
        mockClearSignupAttribution.mockResolvedValue(undefined)
        mockHasPendingSignupAttribution.mockResolvedValue(false)
        jest.mocked(capturePasskeyDebugInfo).mockResolvedValue(undefined as never)
        mockAddAccount.mockImplementation(async () => {
            accounts = [{ type: AccountType.PEANUT_WALLET }]
        })
    })

    it('offers a single retry while the network is busy and recovers after a second failure', async () => {
        mockSendUserOp.mockRejectedValueOnce(stalled())
        renderWithIntl(<SignTestTransaction merged />)
        fireEvent.click(screen.getByRole('button', { name: en.setup.cta.finish }))

        const retry = await screen.findByRole('button', { name: en.common.tryAgain })
        let rejectRetry: (error: unknown) => void = () => undefined
        mockSendUserOp.mockReturnValueOnce(
            new Promise((_, reject) => {
                rejectRetry = reject
            })
        )
        fireEvent.click(retry)
        fireEvent.click(retry)
        expect(mockSendUserOp).toHaveBeenCalledTimes(2)
        expect(retry).toBeDisabled()
        rejectRetry(stalled())

        mockSendUserOp.mockResolvedValueOnce({ userOpHash: HASH, reusedSignature: true, sends: 1, recovered: [] })
        fireEvent.click(await screen.findByRole('button', { name: en.common.tryAgain }))
        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled())
        expect(mockSendUserOp).toHaveBeenCalledTimes(3)
        expect(mockAddAccount).toHaveBeenCalledTimes(1)
    })

    it('after two transient failures the person can finish, and the confirmation stays pending', async () => {
        saveSignupTestTransaction('user-1', pending())
        mockSendUserOp.mockRejectedValueOnce(stalled())
        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await screen.findByText(en.setup.testTransaction.errors.networkBusy)

        expect(screen.getByText(en.setup.testTransaction.finishLaterDescription)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.setup.testTransaction.finishLater }))
        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled())

        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
        expect(mockAddAccount).toHaveBeenCalledTimes(1)
        expect(readSignupTestTransaction('user-1')).toMatchObject({ deferred: true, mined: false })
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_TEST_TX_DEFERRED, {
            transient_failures: 2,
            signature_check: 'valid',
        })
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_COMPLETED,
            expect.objectContaining({ test_tx: 'deferred' })
        )
    })

    it('never offers to finish when the validator rejected the signature (AA24)', async () => {
        saveSignupTestTransaction('user-1', pending({ signatureRejected: true }))
        const aa24 = Object.assign(new Error('Signature provided for the User Operation is invalid.'), {
            name: 'UserOperationExecutionError',
            details: 'UserOperation reverted with reason: AA24 signature error',
        })
        mockSendUserOp.mockRejectedValueOnce(new SignupTestTxError('submit', aa24, 'valid'))
        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await screen.findByText(en.setup.testTransaction.errors.passkeyProviderUnsupported)
        expect(screen.queryByRole('button', { name: en.setup.testTransaction.finishLater })).not.toBeInTheDocument()
        expect(mockAddAccount).not.toHaveBeenCalled()
    })

    it('a confirmed signup clears the stored operation', async () => {
        saveSignupTestTransaction('user-1', pending({ transientFailures: 0 }))
        mockSendUserOp.mockResolvedValueOnce({ userOpHash: HASH, reusedSignature: true, sends: 1, recovered: [] })
        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled())
        expect(readSignupTestTransaction('user-1')).toBeNull()
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_COMPLETED,
            expect.objectContaining({ test_tx: 'confirmed' })
        )
    })
})

it('includes both selected methods in the account-completion request', async () => {
    mockFundingChannel = 'brlBank'
    mockPaymentChannel = 'qr'
    jest.clearAllMocks()
    mockSignupCompleted = false
    mockSendUserOp.mockResolvedValue({ userOpHash: '0xhash' })
    mockReadSignupAttributionAsync.mockResolvedValue(null)
    mockHasPendingSignupAttribution.mockResolvedValue(false)
    mockClearSignupAttribution.mockResolvedValue(undefined)
    accounts = []
    mockAddAccount.mockImplementation(async () => {
        accounts = [{ type: AccountType.PEANUT_WALLET }]
    })
    renderWithIntl(<SignTestTransaction />)
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() =>
        expect(mockAddAccount).toHaveBeenCalledWith(
            expect.objectContaining({ signupPreferences: { fundingChannel: 'brlBank', paymentChannel: 'qr' } })
        )
    )
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled())
})

it('reports the passkey explainer, its Got it and dismissal, Log out and Confirm on /setup/finish', async () => {
    mockSendUserOp.mockReturnValue(new Promise(() => undefined))
    renderWithIntl(onSignupScreen('sign-test-transaction', <SignTestTransaction showLogout />))
    fireEvent.click(screen.getByRole('button', { name: 'Learn more about Passkeys' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Learn more about Passkeys', hidden: true }))
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Log out', hidden: true }))
    fireEvent.click(screen.getByRole('button', { name: en.setup.testTransaction.confirmAndFinish, hidden: true }))
    expect(signupControls(posthog.capture as jest.Mock)).toEqual([
        'passkey_info:open',
        'passkey_info_got_it:tap',
        'passkey_info:open',
        'passkey_info:dismiss',
        'log_out:tap',
        'finish:tap',
    ])
})
