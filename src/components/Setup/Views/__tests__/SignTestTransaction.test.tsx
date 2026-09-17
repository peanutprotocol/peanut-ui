import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { getRedirectUrl, setRedirectUrl } from '@/utils/general.utils'
import SignTestTransaction from '../SignTestTransaction'
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
const mockReadSignupAttributionAsync = jest.fn()
const mockClearSignupAttribution = jest.fn()

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
jest.mock('@/utils/signup-attribution', () => ({
    readSignupAttributionAsync: (...args: unknown[]) => mockReadSignupAttributionAsync(...args),
    clearSignupAttribution: (...args: unknown[]) => mockClearSignupAttribution(...args),
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
        mockSendUserOp.mockResolvedValue({ userOpHash: '0xhash' })
        mockReadSignupAttributionAsync.mockResolvedValue(null)
        mockClearSignupAttribution.mockResolvedValue(undefined)
        // addAccount refetches the user, so the account appears before the
        // completion redirect — the pre-existing-account effect must not race it.
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

        // A later focus/profile refresh reveals that the first request did
        // commit. The Retry action must consume the signup marker and finish.
        accounts = [{ type: AccountType.PEANUT_WALLET }]
        rerender(<SignTestTransaction />)
        fireEvent.click(screen.getByRole('button', { name: /retry account setup/i }))

        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/home'))
        expect(mockAddAccount).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
    })

    it('redirects immediately after account finalization', async () => {
        renderWithIntl(<SignTestTransaction />)

        const confirmButton = screen.getByRole('button', { name: /confirm/i })
        fireEvent.click(confirmButton)

        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/home'))
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(confirmButton).toBeDisabled()
        fireEvent.click(confirmButton)
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
        expect(screen.queryByText(/works right now/i)).not.toBeInTheDocument()
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_COMPLETED,
            expect.objectContaining({ flow_version: 1, signup_entry_flow: 'default' })
        )
        expect(mockRouterPush).not.toHaveBeenCalled()
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
})
