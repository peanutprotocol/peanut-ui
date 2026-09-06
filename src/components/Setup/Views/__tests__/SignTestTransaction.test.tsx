import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { saveToLocalStorage } from '@/utils/general.utils'
import SignTestTransaction from '../SignTestTransaction'

const WALLET = '0x1111111111111111111111111111111111111111'

const mockRouterPush = jest.fn()
const mockRouterReplace = jest.fn()
const mockAddAccount = jest.fn()
const mockSendUserOp = jest.fn()

let accounts: Array<{ type: string }> = []

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

jest.mock('@/redux/hooks', () => ({
    useAppDispatch: () => jest.fn(),
    useSetupStore: () => ({ residenceCountry: '', secondResidenceCountry: '', telegramHandle: '' }),
}))

jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@/utils/auth.utils', () => ({ clearAuthState: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))

describe('SignTestTransaction — the account-ready screen', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
        accounts = []
        mockSendUserOp.mockResolvedValue({ userOpHash: '0xhash' })
        // addAccount refetches the user, so the account appears while this
        // screen is up — the pre-existing-account fast path must not fire.
        mockAddAccount.mockImplementation(async () => {
            accounts = [{ type: 'peanut' }]
        })
    })

    it('never navigates on its own — the CTA is the only way off it', async () => {
        renderWithIntl(<SignTestTransaction />)

        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

        await screen.findByText(/works right now/i)
        await waitFor(() => expect(mockAddAccount).toHaveBeenCalled())
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterReplace).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: /go to my account/i }))
        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        expect(mockRouterPush).not.toHaveBeenCalled()
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

        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(mockRouterReplace).toHaveBeenCalledWith('/receipt?id=abc')
    })
})
