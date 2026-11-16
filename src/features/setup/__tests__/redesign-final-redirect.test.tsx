/** @jest-environment jsdom */
/**
 * P4-56: the celebration's redirect (`useAccountSetup().handleRedirect({ isNewAccount: true })`) takes the claim
 * link in `redirect_uri` over a route stored earlier, so a claim sign-up returns to its link (SPEC-GAPS a26).
 */
import { renderHook } from '@testing-library/react'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { getRedirectUrl, setRedirectUrl } from '@/utils/general.utils'

const mockReplace = jest.fn()
let mockRedirectUri: string | null = null
jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
    useSearchParams: () => ({ get: (key: string) => (key === 'redirect_uri' ? mockRedirectUri : null) }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1' }, accounts: [] }, addAccount: jest.fn() }),
}))
jest.mock('@sentry/nextjs', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }))

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    mockRedirectUri = null
})

it('P4-56 redirect_uri=/claim/abc wins over a stored /profile/identity-verification', () => {
    mockRedirectUri = '/claim/abc'
    setRedirectUrl('/profile/identity-verification')
    const { result } = renderHook(() => useAccountSetup())
    const explicit = result.current.handleRedirect({ isNewAccount: true })
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/claim/abc')
    expect(explicit).toBe(true)
})

it('P4-56 without a claim link a new account goes home, not to a page an earlier session ended on', () => {
    setRedirectUrl('/profile', 'session-end')
    const { result } = renderHook(() => useAccountSetup())
    result.current.handleRedirect({ isNewAccount: true })
    expect(mockReplace).toHaveBeenCalledWith('/home')
    expect(getRedirectUrl()).toBeNull()
})
