import { act, renderHook } from '@testing-library/react'
import { useLogin } from '../useLogin'

const mockLogin = jest.fn()
const mockPush = jest.fn()
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'existing' } } }) }))
jest.mock('../useZeroDev', () => ({ useZeroDev: () => ({ handleLogin: mockLogin, isLoggingIn: false }) }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/services/post-auth-redirect', () => ({ consumePostAuthRedirect: () => ({ destination: '/home' }) }))

beforeEach(() => jest.resetAllMocks())

it('waits for manual login verification before redirecting an existing session', async () => {
    let finish!: () => void
    mockLogin.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            finish = resolve
        })
    )
    const { result } = renderHook(() => useLogin())
    let pending!: Promise<boolean>
    act(() => {
        pending = result.current.handleLoginClick()
    })
    expect(mockLogin).toHaveBeenCalledWith({}) // no options: scoped to the signed-in user
    expect(mockPush).not.toHaveBeenCalled()
    await act(async () => {
        finish()
        await pending
    })
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/home')
})

it('does not redirect an existing session when manual login fails', async () => {
    const error = new Error('verification failed')
    mockLogin.mockRejectedValueOnce(error)
    const { result } = renderHook(() => useLogin())
    await act(async () => {
        await expect(result.current.handleLoginClick()).rejects.toBe(error)
    })
    expect(mockPush).not.toHaveBeenCalled()
})

describe('stayIfUserId: the passkey picked opens the account the person is already in', () => {
    it('the same account: no redirect, resolves false', async () => {
        mockLogin.mockResolvedValueOnce({ user: { userId: 'existing' } })
        const { result } = renderHook(() => useLogin())
        let left: boolean | undefined
        await act(async () => {
            left = await result.current.handleLoginClick({ scopeToUser: false, stayIfUserId: 'existing' })
        })
        expect(mockLogin).toHaveBeenCalledWith({ scopeToUser: false })
        expect(left).toBe(false)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('another account: redirects as today, resolves true', async () => {
        mockLogin.mockResolvedValueOnce({ user: { userId: 'older' } })
        const { result } = renderHook(() => useLogin())
        let left: boolean | undefined
        await act(async () => {
            left = await result.current.handleLoginClick({ scopeToUser: false, stayIfUserId: 'existing' })
        })
        expect(left).toBe(true)
        expect(mockPush).toHaveBeenCalledWith('/home')
    })
})
