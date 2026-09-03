import { act, waitFor } from '@testing-library/react'
// These hooks localize their error copy now, so they need the intl provider.
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { getRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'
import { useAccountSetup } from '../useAccountSetup'
import { useLogin } from '../useLogin'

const mockRouterPush = jest.fn()
const mockRouterReplace = jest.fn()
const mockHandleLogin = jest.fn()
const mockAddAccount = jest.fn()
const mockToastError = jest.fn()
let explicitRedirect: string | null = null

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
    useSearchParams: () => ({
        get: (key: string) => (key === 'redirect_uri' ? explicitRedirect : null),
    }),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'user-1' } },
        addAccount: mockAddAccount,
    }),
}))

jest.mock('../useZeroDev', () => ({
    useZeroDev: () => ({ handleLogin: mockHandleLogin, isLoggingIn: false }),
}))

jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: mockToastError }),
}))

jest.mock('@/redux/hooks', () => ({
    useSetupStore: () => ({ telegramHandle: '' }),
}))

jest.mock('@/utils/auth.utils', () => ({ clearAuthState: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const FINANCIAL_REDIRECT = '/claim?step=claim&id=payment-1'
const CAMPAIGN_REDIRECT = '/add-money/crypto?network=EVM'

describe('post-auth redirect consumers', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
        explicitRedirect = FINANCIAL_REDIRECT
        mockHandleLogin.mockResolvedValue(undefined)
    })

    it('account setup consumes a superseded campaign redirect when the explicit financial route wins', () => {
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)
        const { result } = renderHook(() => useAccountSetup())

        act(() => expect(result.current.handleRedirect()).toBe(true))

        // the setup→destination leg replaces: back from there must not re-enter a finished /setup
        expect(mockRouterReplace).toHaveBeenCalledWith(FINANCIAL_REDIRECT)
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(getRedirectUrl()).toBeNull()
    })

    it('finalizing the account does not navigate — the account-ready screen owns the redirect', async () => {
        mockAddAccount.mockResolvedValue(undefined)
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)
        const { result } = renderHook(() => useAccountSetup())

        await act(async () => {
            await expect(result.current.finalizeAccountSetup('0xabc')).resolves.toBe(true)
        })

        expect(mockAddAccount).toHaveBeenCalled()
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterReplace).not.toHaveBeenCalled()
        // the redirect is still queued for the CTA to consume
        expect(getRedirectUrl()).toBe(CAMPAIGN_REDIRECT)
    })

    it('login cannot resurrect a campaign redirect after an explicit financial route consumed it', async () => {
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)
        const first = renderHook(() => useLogin())

        await act(async () => first.result.current.handleLoginClick())
        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith(FINANCIAL_REDIRECT))
        expect(getRedirectUrl()).toBeNull()
        first.unmount()

        mockRouterPush.mockClear()
        explicitRedirect = null
        const later = renderHook(() => useLogin())

        await act(async () => later.result.current.handleLoginClick())
        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/home'))
    })
})
