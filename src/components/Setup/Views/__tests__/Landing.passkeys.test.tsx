/** @jest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import type { ReactNode } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import Landing from '../Landing'

const mockLogin = jest.fn()
const mockNext = jest.fn()
const mockToastError = jest.fn()
const mockAvailabilityCall = jest.fn()
const mockIOSCapability = jest.fn()
const mockCancelIOS = jest.fn()
let mockIsLoggingIn = false
let mockNative = {
    isCapacitor: true,
    isHydrated: true,
    isNativeBridge: true,
    isIOSNative: true,
    isAndroidNative: false,
    isAndroidNativeBridge: false,
    platform: 'ios',
}

jest.mock('@/hooks/useLogin', () => ({
    useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: mockIsLoggingIn }),
}))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/utils/native-platform', () => ({ useNativePlatform: () => mockNative }))
// Any native plugin call made through nativeCapability, such as the Android PasskeyAvailability check.
jest.mock('@/utils/native-capability', () => ({
    nativeCapability: (plugin: string) => ({
        call: (...args: unknown[]) => mockAvailabilityCall(plugin, ...args),
    }),
}))
jest.mock('@/utils/landing-passkeys', () => ({
    ...jest.requireActual('@/utils/landing-passkeys'),
    supportsIOSImmediateLogin: () => mockIOSCapability(),
    cancelIOSImmediateLogin: () => mockCancelIOS(),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
        loading,
    }: {
        children: ReactNode
        onClick?: () => void
        disabled?: boolean
        loading?: boolean
    }) => (
        <button data-control="full" data-loading={loading || undefined} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/0_Bruddle/LinkButton', () => ({
    LINK_BUTTON_CLASSES: '',
    LinkButton: ({
        children,
        onClick,
        disabled,
    }: {
        children: ReactNode
        onClick?: () => void
        disabled?: boolean
    }) => (
        <button data-control="link" onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('../../components/SetupFooter', () => ({
    __esModule: true,
    default: ({
        actions,
        secondary,
        children,
    }: {
        actions?: ReactNode
        secondary?: ReactNode
        children?: ReactNode
    }) => (
        <div>
            {actions}
            {secondary}
            {children}
        </div>
    ),
}))
jest.mock('@/components/Setup/components/SetupDocsDrawer', () => ({
    SetupDocLink: ({
        children,
        href,
        onBeforeOpen,
    }: {
        children: ReactNode
        href?: string
        onBeforeOpen?: () => void
    }) => (
        <a
            href={href}
            onClick={(event) => {
                event.preventDefault()
                onBeforeOpen?.()
            }}
        >
            {children}
        </a>
    ),
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/features/setup/useSignupControl', () => ({ useSignupControl: () => ({ track: jest.fn() }) }))
jest.mock('../LoginRecoveryDrawer', () => ({
    LoginRecoveryDrawer: ({ visible }: { visible: boolean }) => (visible ? <div role="dialog">recovery</div> : null),
}))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => true }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    useDeviceType: () => ({ deviceType: 'web' }),
    DeviceType: { WEB: 'web' },
}))
jest.mock('@/components/Migration/StoreButtons', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/demo', () => ({ disableDemoMode: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: Error) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}
const flush = async () => {
    await act(async () => {
        await Promise.resolve()
    })
}
const advance = async (milliseconds: number) => {
    await act(async () => {
        jest.advanceTimersByTime(milliseconds)
        await Promise.resolve()
    })
}
/** The curated error useZeroDev.handleLogin throws. */
const passkeyError = (code: string) => Object.assign(new Error('curated'), { name: 'PasskeyError', code })
const signUp = () => screen.getByRole('button', { name: 'landing.signUp' })
const login = () => screen.getByRole('button', { name: 'landing.logIn' })
const manualLogins = () => mockLogin.mock.calls.filter((args) => args.length === 0).length
const loginErrors = () =>
    (posthog.capture as jest.Mock).mock.calls
        .filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR)
        .map(([, properties]) => properties)
/** Sign up and the full-size login button, both usable, and no text-link fallback. */
const expectBothButtons = () => {
    expect(signUp()).toBeEnabled()
    expect(login()).toHaveAttribute('data-control', 'full')
    expect(login()).toBeEnabled()
    expect(login()).not.toHaveAttribute('data-loading')
    expect(document.querySelector('[data-control="link"]')).toBeNull()
}

type Platform = 'ios' | 'ios-unsupported' | 'old-ios' | 'android' | 'hydrating' | 'web'
function platform(name: Platform) {
    if (name === 'android') {
        mockNative = {
            ...mockNative,
            platform: 'android',
            isIOSNative: false,
            isAndroidNative: true,
            isAndroidNativeBridge: true,
        }
    }
    if (name === 'ios-unsupported') mockIOSCapability.mockResolvedValue(false)
    if (name === 'old-ios') mockNative.isNativeBridge = false
    if (name === 'hydrating') mockNative.isHydrated = false
    if (name === 'web') {
        mockNative = {
            isCapacitor: false,
            isHydrated: true,
            isNativeBridge: false,
            isIOSNative: false,
            isAndroidNative: false,
            isAndroidNativeBridge: false,
            platform: 'web',
        }
    }
}

// A native request still pending at the deadline must not hold the fallback for the 60 s ceremony bound.
// iOS can settle a retired request as a cancel, so the retirement, not the error, decides that it is no miss.
function pendingAutoLogin() {
    mockIOSCapability.mockResolvedValue(true)
    mockLogin.mockImplementationOnce(
        ({ cancelSignal }: { cancelSignal: AbortSignal }) =>
            new Promise<void>((_, reject) => {
                cancelSignal.addEventListener('abort', () => {
                    mockIsLoggingIn = false
                    reject(passkeyError('LOGIN_CANCELED'))
                })
            })
    )
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.resetAllMocks()
    mockNative = {
        isCapacitor: true,
        isHydrated: true,
        isNativeBridge: true,
        isIOSNative: true,
        isAndroidNative: false,
        isAndroidNativeBridge: false,
        platform: 'ios',
    }
    mockAvailabilityCall.mockImplementation(() => new Promise(() => {}))
    mockIOSCapability.mockImplementation(() => new Promise(() => {}))
    mockLogin.mockResolvedValue(undefined)
    mockCancelIOS.mockResolvedValue(undefined)
    mockIsLoggingIn = false
})
afterEach(() => {
    cleanup()
    jest.useRealTimers()
})

describe('landing login button from the first frame (TASK-24885)', () => {
    it.each<Platform>(['ios', 'ios-unsupported', 'old-ios', 'android', 'hydrating', 'web'])(
        'shows Sign up and the login button in the first render on %s',
        async (name) => {
            platform(name)
            render(<Landing />)
            expectBothButtons()
            expect(screen.getByText('landing.recoverWallet')).toBeInTheDocument()
            await flush()
            expectBothButtons()
        }
    )

    it.each<Platform>(['ios', 'ios-unsupported', 'old-ios', 'android', 'web'])(
        'keeps the same login button through the 5 s deadline on %s',
        async (name) => {
            platform(name)
            render(<Landing />)
            const first = login()
            await flush()
            await advance(4999)
            await advance(1)
            await flush()
            // The same element in the same slot: nothing replaces it, so nothing shifts.
            expect(login()).toBe(first)
            expectBothButtons()
            expect(mockToastError).not.toHaveBeenCalled()
        }
    )

    it('does not ask Android for passkey availability', async () => {
        platform('android')
        render(<Landing />)
        await flush()
        await advance(5000)
        expect(mockAvailabilityCall).not.toHaveBeenCalled()
        expect(mockIOSCapability).not.toHaveBeenCalled()
        expectBothButtons()
        fireEvent.click(login())
        expect(mockLogin).toHaveBeenCalledWith()
    })

    it('logs in from the first frame on the keep-web layout without native probes', async () => {
        platform('web')
        render(<Landing />)
        fireEvent.click(login())
        expect(mockLogin).toHaveBeenCalledWith()
        await advance(5000)
        expect(mockAvailabilityCall).not.toHaveBeenCalled()
        expect(mockIOSCapability).not.toHaveBeenCalled()
        expect(mockLogin).toHaveBeenCalledTimes(1)
    })
})

describe('iOS automatic login', () => {
    it('starts iOS automatic login once only after early confirmed capability and aborts on leaving', async () => {
        const capability = deferred<boolean>()
        mockIOSCapability.mockReturnValue(capability.promise)
        mockLogin.mockImplementation(() => new Promise(() => {}))
        const mountedAt = Date.now()
        const view = render(<Landing />)
        expect(mockLogin).not.toHaveBeenCalled()
        await advance(1000)
        await act(async () => capability.resolve(true))
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockLogin).toHaveBeenCalledWith({
            immediateSignal: expect.any(AbortSignal),
            immediateDeadline: mountedAt + 5000,
            cancelSignal: expect.any(AbortSignal),
        })
        const signal = mockLogin.mock.calls[0][0].immediateSignal as AbortSignal
        view.rerender(<Landing />)
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(signal.aborted).toBe(false)
        view.unmount()
        expect(signal.aborted).toBe(true)
    })

    it('keeps both buttons usable, and the login button out of loading, while the automatic attempt is pending', async () => {
        pendingAutoLogin()
        const view = render(<Landing />)
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(1)
        // useLogin reports the automatic ceremony as a login in flight.
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        expectBothButtons()
        await advance(5000)
        expectBothButtons()
    })

    it('stays quiet when the automatic attempt logs in', async () => {
        mockIOSCapability.mockResolvedValue(true)
        render(<Landing />)
        await flush()
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({ immediateSignal: expect.any(AbortSignal) }))
        // useLogin owns the redirect; the landing adds no error UI and frees the native slot as before.
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        expect(mockToastError).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(loginErrors()).toEqual([])
        expectBothButtons()
    })

    it('Log in retires the pending automatic login before one manual login, and a manual cancel then toasts', async () => {
        pendingAutoLogin()
        mockLogin.mockImplementationOnce(() => Promise.reject(passkeyError('LOGIN_CANCELED')))
        const view = render(<Landing />)
        await flush()
        const { cancelSignal } = mockLogin.mock.calls[0][0] as { cancelSignal: AbortSignal }
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        const cancelled = deferred<void>()
        mockCancelIOS.mockReturnValueOnce(cancelled.promise)
        fireEvent.click(login())
        await flush()
        expect(cancelSignal.aborted).toBe(true)
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        // the manual request waits until the native slot is free
        expect(mockLogin).toHaveBeenCalledTimes(1)
        await act(async () => cancelled.resolve())
        await flush()
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(2)
        expect(mockLogin).toHaveBeenLastCalledWith()
        // A retired attempt is no miss, so the first manual cancel keeps the toast.
        expect(mockToastError).toHaveBeenCalledTimes(1)
        expect(mockToastError).toHaveBeenCalledWith('passkey.notCompleted')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(loginErrors()).toEqual([expect.objectContaining({ recovery_drawer: false, after_auto_miss: false })])
        // a second tap while a manual login runs does not start another one
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        expect(login()).toBeDisabled()
    })

    it('a double tap on Log in during the automatic attempt starts one manual login', async () => {
        pendingAutoLogin()
        render(<Landing />)
        await flush()
        fireEvent.click(login())
        fireEvent.click(login())
        await flush()
        await flush()
        await flush()
        expect(manualLogins()).toBe(1)
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
    })

    it('Sign up retires the pending automatic login before leaving the landing', async () => {
        pendingAutoLogin()
        const view = render(<Landing />)
        await flush()
        const { cancelSignal } = mockLogin.mock.calls[0][0] as { cancelSignal: AbortSignal }
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        fireEvent.click(signUp())
        await flush()
        await flush()
        expect(cancelSignal.aborted).toBe(true)
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect((posthog.capture as jest.Mock).mock.calls).toEqual([[ANALYTICS_EVENTS.SIGNUP_CLICKED]])
        expect(mockToastError).not.toHaveBeenCalled()
    })

    it('frees the native slot when the automatic attempt times out, so the next Log in is not refused', async () => {
        mockIOSCapability.mockResolvedValue(true)
        // The native callback never arrives; the ceremony guard gives up at its 60 s bound.
        mockLogin.mockImplementationOnce(
            () =>
                new Promise<void>((_, reject) => {
                    setTimeout(() => {
                        mockIsLoggingIn = false
                        reject(passkeyError('CEREMONY_TIMEOUT'))
                    }, 60_000)
                })
        )
        const view = render(<Landing />)
        await flush()
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        await advance(5000)
        expect(mockCancelIOS).not.toHaveBeenCalled()
        await advance(55_000)
        await flush()
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        view.rerender(<Landing />)
        fireEvent.click(login())
        expect(mockLogin).toHaveBeenCalledTimes(2)
        expect(mockLogin).toHaveBeenLastCalledWith()
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        expect(mockToastError).not.toHaveBeenCalled()
    })

    it('a manual login in flight still disables Log in when no automatic attempt is pending', async () => {
        platform('ios-unsupported')
        mockIsLoggingIn = true
        render(<Landing />)
        await flush()
        expect(login()).toBeDisabled()
        expect(login()).toHaveAttribute('data-loading', 'true')
        expect(mockCancelIOS).not.toHaveBeenCalled()
    })

    it('keeps an ambiguous automatic rejection quiet and leaves Log in as it was', async () => {
        mockIOSCapability.mockResolvedValue(true)
        mockLogin.mockRejectedValueOnce(new Error('ambiguous native failure'))
        render(<Landing />)
        await flush()
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockToastError).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expectBothButtons()
        fireEvent.click(login())
        expect(mockLogin).toHaveBeenLastCalledWith()
    })

    it.each(['old bridge', 'unsupported', 'rejected', 'hung'])(
        'never automatically opens iOS UI for %s',
        async (outcome) => {
            if (outcome === 'old bridge') mockNative.isNativeBridge = false
            if (outcome === 'unsupported') mockIOSCapability.mockResolvedValue(false)
            if (outcome === 'rejected') mockIOSCapability.mockRejectedValue(new Error('capability unavailable'))
            render(<Landing />)
            await flush()
            await advance(5000)
            expectBothButtons()
            expect(mockLogin).not.toHaveBeenCalled()
            expect(mockToastError).not.toHaveBeenCalled()
        }
    )

    it('an old binary has no automatic attempt: the first manual cancel toasts, the second opens recovery', async () => {
        platform('ios-unsupported')
        mockLogin.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        render(<Landing />)
        await flush()
        expect(mockLogin).not.toHaveBeenCalled()
        fireEvent.click(login())
        await flush()
        expect(mockToastError).toHaveBeenCalledTimes(1)
        expect(mockToastError).toHaveBeenCalledWith('passkey.notCompleted')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        fireEvent.click(login())
        await flush()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(mockToastError).toHaveBeenCalledTimes(1)
        expect(loginErrors()).toEqual([
            expect.objectContaining({ error_code: 'LOGIN_CANCELED', recovery_drawer: false }),
            expect.objectContaining({ error_code: 'LOGIN_CANCELED', recovery_drawer: true }),
        ])
    })

    it('a preparation cut off by the 5 s deadline is no miss: the next manual cancel toasts', async () => {
        mockIOSCapability.mockResolvedValue(true)
        // handleLogin classifies the expired preparation (AbortError) as LOGIN_ERROR.
        mockLogin.mockImplementationOnce(
            ({ immediateSignal }: { immediateSignal: AbortSignal }) =>
                new Promise<void>((_, reject) => {
                    immediateSignal.addEventListener('abort', () => reject(passkeyError('LOGIN_ERROR')))
                })
        )
        mockLogin.mockImplementationOnce(() => Promise.reject(passkeyError('LOGIN_CANCELED')))
        render(<Landing />)
        await flush()
        await advance(5000)
        await flush()
        await flush()
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        expect(mockToastError).not.toHaveBeenCalled()
        fireEvent.click(login())
        await flush()
        expect(manualLogins()).toBe(1)
        expect(mockToastError).toHaveBeenCalledWith('passkey.notCompleted')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(loginErrors()).toEqual([expect.objectContaining({ recovery_drawer: false, after_auto_miss: false })])
    })

    it('does not auto-login after the wall-clock deadline even when the deadline timer has not fired', async () => {
        const capability = deferred<boolean>()
        mockIOSCapability.mockReturnValue(capability.promise)
        render(<Landing />)
        jest.setSystemTime(Date.now() + 5001)
        await act(async () => capability.resolve(true))
        expect(mockLogin).not.toHaveBeenCalled()
    })

    function selectIOSFallback(action: 'signup' | 'recovery') {
        if (action === 'signup') fireEvent.click(signUp())
        else fireEvent.click(screen.getByText('landing.recoverWallet'))
    }

    it.each(['signup', 'recovery'] as const)(
        'does not start iOS auto-login after %s during capability lookup',
        async (action) => {
            const capability = deferred<boolean>()
            mockIOSCapability.mockReturnValue(capability.promise)
            render(<Landing />)

            selectIOSFallback(action)
            await act(async () => capability.resolve(true))

            if (action === 'signup') expect(mockNext).toHaveBeenCalledTimes(1)
            expect(mockLogin).not.toHaveBeenCalled()
            expect(mockCancelIOS).not.toHaveBeenCalled()
        }
    )

    it.each(['signup', 'recovery'] as const)(
        'prevents a late iOS picker after %s during options fetch',
        async (action) => {
            mockIOSCapability.mockResolvedValue(true)
            const options = deferred<void>()
            const dispatchPicker = jest.fn()
            mockLogin.mockImplementationOnce(
                ({ immediateSignal, cancelSignal }: { immediateSignal: AbortSignal; cancelSignal: AbortSignal }) => {
                    // The SDK options request and outer ceremony guard observe different signals.
                    void options.promise.then(() => {
                        if (!immediateSignal.aborted) dispatchPicker()
                    })
                    return new Promise<void>((resolve) => {
                        cancelSignal.addEventListener('abort', () => resolve(), { once: true })
                    })
                }
            )
            render(<Landing />)
            await flush()
            expect(mockLogin).toHaveBeenCalledTimes(1)

            selectIOSFallback(action)
            await act(async () => options.resolve())

            if (action === 'signup') expect(mockNext).toHaveBeenCalledTimes(1)
            expect(dispatchPicker).not.toHaveBeenCalled()
            expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        }
    )

    it('ignores iOS capability confirmed after timeout or unmount', async () => {
        const capability = deferred<boolean>()
        mockIOSCapability.mockReturnValue(capability.promise)
        const view = render(<Landing />)
        await advance(5000)
        await act(async () => capability.resolve(true))
        expect(mockLogin).not.toHaveBeenCalled()
        expectBothButtons()
        view.unmount()
        const secondCapability = deferred<boolean>()
        mockIOSCapability.mockReturnValue(secondCapability.promise)
        const secondView = render(<Landing />)
        secondView.unmount()
        await act(async () => secondCapability.resolve(true))
        expect(mockLogin).not.toHaveBeenCalled()
    })
})
