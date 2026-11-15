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
    let pending!: Promise<void>
    act(() => {
        pending = result.current.handleLoginClick()
    })
    expect(mockLogin).toHaveBeenCalledWith()
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
