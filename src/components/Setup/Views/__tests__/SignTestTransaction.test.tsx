import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { getRedirectUrl, saveToLocalStorage, setRedirectUrl } from '@/utils/general.utils'
import {
    SETUP_ACCOUNT_READY_EXPERIMENT_FLAG,
    SETUP_ACCOUNT_READY_SKIP_VARIANT,
    default as SignTestTransaction,
} from '../SignTestTransaction'
import { capturePasskeyDebugInfo } from '@/utils/passkeyDebug'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { AccountSetupError } from '@/services/account-setup'
import { AccountType } from '@/interfaces/interfaces'

const WALLET = '0x1111111111111111111111111111111111111111'

const mockRouterPush = jest.fn()
const mockRouterReplace = jest.fn()
const mockAddAccount = jest.fn()
const mockSendUserOp = jest.fn()

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
    useZeroDev: () => ({ address: WALLET, handleSendUserOpEncoded: mockSendUserOp }),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'user-1', username: 'kim' }, accounts },
        isFetchingUser: false,
        fetchUser: jest.fn(),
        addAccount: mockAddAccount,
    }),
}))

jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({
        residenceCountry: '',
        secondResidenceCountry: '',
        setIsLoading: jest.fn(),
        steps: [{ screenId: 'signup' }, { screenId: 'passkey-permission' }, { screenId: 'sign-test-transaction' }],
        signupEntryFlow: 'default',
    }),
}))

jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@/utils/auth.utils', () => ({ clearAuthState: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: jest.fn(),
        getFeatureFlagResult: jest.fn(),
        setPersonProperties: jest.fn(),
    },
}))

describe('SignTestTransaction — the account-ready screen', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
        accounts = []
        mockSendUserOp.mockResolvedValue({ userOpHash: '0xhash' })
        jest.mocked(posthog.getFeatureFlagResult).mockReturnValue({
            key: SETUP_ACCOUNT_READY_EXPERIMENT_FLAG,
            enabled: true,
            variant: 'control',
            payload: undefined,
        })
        // addAccount refetches the user, so the account appears while this
        // screen is up — the pre-existing-account fast path must not fire.
        mockAddAccount.mockImplementation(async () => {
            accounts = [{ type: AccountType.PEANUT_WALLET }]
        })
    })

    it('releases the confirm button when signing fails even if diagnostics never finish', async () => {
        mockSendUserOp.mockRejectedValueOnce(new Error('Signing failed'))
        jest.mocked(capturePasskeyDebugInfo).mockReturnValueOnce(new Promise(() => {}))
        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(capturePasskeyDebugInfo).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled())
        expect(mockAddAccount).not.toHaveBeenCalled()
    })

    it('shows account-ready when Retry discovers an account from the ambiguous request', async () => {
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

        // A later focus/profile refresh reveals that the first request did
        // commit. The Retry action must consume the signup marker and finish.
        accounts = [{ type: AccountType.PEANUT_WALLET }]
        rerender(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /retry account setup/i }))

        await screen.findByText(/works right now/i)
        expect(mockAddAccount).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('never navigates on its own — the CTA is the only way off it', async () => {
        renderWithIntl(<SignTestTransaction />)

        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

        await screen.findByText(/works right now/i)
        await waitFor(() => expect(mockAddAccount).toHaveBeenCalled())
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
            screen_id: 'account-ready',
            step_index: 4,
            total_steps: 4,
            nav_type: 'forward',
            flow_version: 1,
            signup_entry_flow: 'default',
        })
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterReplace).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: /go to my account/i }))
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_ACCOUNT_READY_CTA_CLICKED, {
            flow_version: 1,
            signup_entry_flow: 'default',
        })
        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('redirects automatically after account finalization for the skip-screen variant', async () => {
        jest.mocked(posthog.getFeatureFlagResult).mockReturnValue({
            key: SETUP_ACCOUNT_READY_EXPERIMENT_FLAG,
            enabled: true,
            variant: SETUP_ACCOUNT_READY_SKIP_VARIANT,
            payload: undefined,
        })
        saveToLocalStorage('redirect', '/receipt?id=abc')

        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/receipt?id=abc'))
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(posthog.getFeatureFlagResult).toHaveBeenCalledWith(SETUP_ACCOUNT_READY_EXPERIMENT_FLAG)
        expect(screen.queryByText(/works right now/i)).not.toBeInTheDocument()
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_COMPLETED,
            expect.objectContaining({ flow_version: 1, signup_entry_flow: 'default' })
        )
        expect(
            jest
                .mocked(posthog.capture)
                .mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_ACCOUNT_READY_CTA_CLICKED)
        ).toHaveLength(0)
    })

    it('keeps the current account-ready screen when the experiment flag is unavailable', async () => {
        jest.mocked(posthog.getFeatureFlagResult).mockReturnValue(undefined)

        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

        await screen.findByText(/works right now/i)
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('consumes the stored route once, however fast the CTA is tapped', async () => {
        // handleRedirect clears the stored route, so a second tap would fall
        // back to /home and race the first push.
        saveToLocalStorage('redirect', '/receipt?id=abc')

        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await screen.findByText(/works right now/i)

        const cta = screen.getByRole('button', { name: /go to my account/i })
        fireEvent.click(cta)
        fireEvent.click(cta)
        fireEvent.click(cta)

        expect(
            jest
                .mocked(posthog.capture)
                .mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_ACCOUNT_READY_CTA_CLICKED)
        ).toHaveLength(1)
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(mockRouterReplace).toHaveBeenCalledWith('/receipt?id=abc')
    })

    /*
     * This CTA is the only caller that declares the account new, and so the
     * only place the cross-account guard is switched on. Without a classified
     * record in the fixture the flag is unobserved — the argument could be
     * deleted with every test here still green, and logout-from-/profile then
     * signup would land on /profile again.
     */
    const completeSignupAndTapCta = async () => {
        renderWithIntl(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await screen.findByText(/works right now/i)
        fireEvent.click(screen.getByRole('button', { name: /go to my account/i }))
    }

    it('refuses a page the previous session was standing on', async () => {
        setRedirectUrl('/profile', 'session-end')

        await completeSignupAndTapCta()

        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        expect(getRedirectUrl()).toBeNull()
    })

    it('still takes a deep link the person asked for', async () => {
        setRedirectUrl('/receipt?id=abc')

        await completeSignupAndTapCta()

        expect(mockRouterReplace).toHaveBeenCalledWith('/receipt?id=abc')
    })
})
