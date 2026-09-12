import { act, waitFor } from '@testing-library/react'
// These hooks localize their error copy now, so they need the intl provider.
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { getRedirectUrl, saveRedirectUrl, saveToLocalStorage, setRedirectUrl } from '@/utils/general.utils'
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

    /*
     * A destination that only marks where an earlier session ended is not the
     * new account's inheritance. This is the reported bug — logout from
     * /profile, create an account, land on /profile — and it survives every
     * same-tab guard: another tab's session can collapse (revoked, expired)
     * and store its own page after this device's logout already finished.
     */
    describe('a brand-new account and a session-end destination', () => {
        beforeEach(() => {
            explicitRedirect = null
            window.history.replaceState({}, '', '/profile')
        })

        it('refuses it and consumes it, so the next account cannot inherit it either', () => {
            saveRedirectUrl('session-end')
            expect(getRedirectUrl()).toBe('/profile')
            const { result } = renderHook(() => useAccountSetup())

            act(() => expect(result.current.handleRedirect({ isNewAccount: true })).toBe(false))

            expect(mockRouterReplace).toHaveBeenCalledWith('/home')
            expect(getRedirectUrl()).toBeNull()
        })

        it('still honours a deep link the person asked for', () => {
            window.history.replaceState({}, '', CAMPAIGN_REDIRECT)
            saveRedirectUrl('deep-link')
            const { result } = renderHook(() => useAccountSetup())

            act(() => expect(result.current.handleRedirect({ isNewAccount: true })).toBe(false))

            expect(mockRouterReplace).toHaveBeenCalledWith(CAMPAIGN_REDIRECT)
        })

        /*
         * Mixed writers: a session ended and recorded itself, then a confirmed
         * invite or campaign continuation replaced the destination. The
         * continuation is the new account's own, so the earlier session's
         * provenance must not outlive the destination it described.
         */
        it('honours a continuation written over a session-end destination', () => {
            saveRedirectUrl('session-end')
            setRedirectUrl('/card')
            const { result } = renderHook(() => useAccountSetup())

            act(() => expect(result.current.handleRedirect({ isNewAccount: true })).toBe(false))

            expect(mockRouterReplace).toHaveBeenCalledWith('/card')
        })

        it('an existing account logging in on this device still resumes where it was', () => {
            saveRedirectUrl('session-end')
            const { result } = renderHook(() => useAccountSetup())

            act(() => expect(result.current.handleRedirect()).toBe(false))

            expect(mockRouterReplace).toHaveBeenCalledWith('/profile')
        })
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
