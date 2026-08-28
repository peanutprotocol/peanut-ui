import { act, waitFor } from '@testing-library/react'
// These hooks localize their error copy now, so they need the intl provider.
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { getRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'
import { useAccountSetup } from '../useAccountSetup'
import { useLogin } from '../useLogin'

const mockRouterPush = jest.fn()
const mockHandleLogin = jest.fn()
const mockAddAccount = jest.fn()
const mockToastError = jest.fn()
let explicitRedirect: string | null = null

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush }),
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

        expect(mockRouterPush).toHaveBeenCalledWith(FINANCIAL_REDIRECT)
        expect(getRedirectUrl()).toBeNull()
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
