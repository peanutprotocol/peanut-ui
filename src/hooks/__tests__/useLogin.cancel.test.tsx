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

it('discards late automatic success after retirement without redirecting an existing session', async () => {
    let finish!: () => void
    mockLogin.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            finish = resolve
        })
    )
    const cancellation = new AbortController()
    const { result } = renderHook(() => useLogin())
    let pending!: Promise<void>
    act(() => {
        pending = result.current.handleLoginClick({
            immediateSignal: new AbortController().signal,
            immediateDeadline: Date.now() + 5000,
            cancelSignal: cancellation.signal,
        })
    })
    cancellation.abort()
    await act(async () => {
        finish()
        await pending
    })
    expect(mockPush).not.toHaveBeenCalled()
})
