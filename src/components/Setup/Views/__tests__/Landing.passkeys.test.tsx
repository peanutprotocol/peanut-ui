/** @jest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import Landing from '../Landing'

const mockLogin = jest.fn()
const mockNext = jest.fn()
const mockToastError = jest.fn()
const mockAndroidCheck = jest.fn()
const mockIOSCapability = jest.fn()
const mockCancelIOS = jest.fn()
let mockIsLoggingIn = false
// the real module keeps one flag per app launch; this copy resets per test
let mockAutoLoginUsed = false
let mockNative = {
    isCapacitor: true,
    isHydrated: true,
    isNativeBridge: true,
    isIOSNative: false,
    isAndroidNativeBridge: true,
    platform: 'android',
}

jest.mock('@/hooks/useLogin', () => ({
    useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: mockIsLoggingIn }),
}))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/utils/native-platform', () => ({ useNativePlatform: () => mockNative }))
jest.mock('@/utils/landing-passkeys', () => ({
    checkAndroidLandingPasskey: (signal: AbortSignal) => mockAndroidCheck(signal),
    supportsIOSImmediateLogin: () => mockIOSCapability(),
    cancelIOSImmediateLogin: () => mockCancelIOS(),
}))
jest.mock('@/features/setup/landing-auto-login', () => ({
    consumeLandingAutoLogin: () => {
        const first = !mockAutoLoginUsed
        mockAutoLoginUsed = true
        return first
    },
    disableLandingAutoLogin: () => {
        mockAutoLoginUsed = true
    },
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
        <button data-control="full" onClick={onClick} disabled={disabled}>
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
    SetupFooter: ({
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
jest.mock('../LoginRecoveryDrawer', () => ({ LoginRecoveryDrawer: () => null }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => true }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    useDeviceType: () => ({ deviceType: 'web' }),
    DeviceType: { WEB: 'web' },
}))
jest.mock('@/components/Migration/StoreButtons', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/demo', () => ({ disableDemoMode: jest.fn() }))
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
const login = () => screen.queryByRole('button', { name: 'logIn' })
const expectEntryActions = () => {
    expect(screen.getByRole('button', { name: 'landing.signUp' })).toBeEnabled()
    expect(screen.getByText('landing.recoverWallet')).toBeInTheDocument()
}
function ios() {
    mockNative = { ...mockNative, platform: 'ios', isIOSNative: true, isAndroidNativeBridge: false }
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.resetAllMocks()
    mockNative = {
        isCapacitor: true,
        isHydrated: true,
        isNativeBridge: true,
        isIOSNative: false,
        isAndroidNativeBridge: true,
        platform: 'android',
    }
    mockAndroidCheck.mockImplementation(() => new Promise(() => {}))
    mockIOSCapability.mockImplementation(() => new Promise(() => {}))
    mockLogin.mockResolvedValue(undefined)
    mockCancelIOS.mockResolvedValue(undefined)
    mockIsLoggingIn = false
    mockAutoLoginUsed = false
})
afterEach(() => {
    cleanup()
    jest.useRealTimers()
})

describe('native landing passkey availability acceptance', () => {
    it.each(['android', 'ios', 'old-ios', 'hydrating'])(
        'keeps signup, recovery and log in visible immediately on %s',
        (platform) => {
            if (platform.includes('ios')) ios()
            if (platform === 'old-ios') mockNative.isNativeBridge = false
            if (platform === 'hydrating') mockNative.isHydrated = false
            render(<Landing />)
            expectEntryActions()
            expect(login()).toHaveAttribute('data-control', 'link')
            expect(mockLogin).not.toHaveBeenCalled()
        }
    )

    it('upgrades the log in link to the full action as soon as Android confirms availability', async () => {
        const check = deferred<'available'>()
        mockAndroidCheck.mockReturnValue(check.promise)
        render(<Landing />)
        expect(login()).toHaveAttribute('data-control', 'link')
        await act(async () => check.resolve('available'))
        expect(login()).toHaveAttribute('data-control', 'full')
        expect(mockLogin).not.toHaveBeenCalled()
        fireEvent.click(login()!)
        expect(mockLogin).toHaveBeenCalledWith()
        await advance(5000)
        expect(login()).toHaveAttribute('data-control', 'full')
        expectEntryActions()
    })

    it.each(['empty', 'rejection'])('offers manual Android login after %s availability', async (outcome) => {
        if (outcome === 'empty') mockAndroidCheck.mockResolvedValue('unavailable')
        else mockAndroidCheck.mockRejectedValue(new Error('query failed'))
        render(<Landing />)
        expectEntryActions()
        await flush()
        expect(login()).toHaveAttribute('data-control', 'link')
        await advance(5000)
        expect(login()).toHaveAttribute('data-control', 'link')
        expect(mockToastError).not.toHaveBeenCalled()
        fireEvent.click(login()!)
        expect(mockLogin).toHaveBeenCalledWith()
        fireEvent.click(screen.getByRole('button', { name: 'landing.signUp' }))
        expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('treats an unexpected Android response as unknown and keeps the log in link', async () => {
        mockAndroidCheck.mockResolvedValue({ unexpected: true })
        render(<Landing />)
        await flush()
        expect(login()).toHaveAttribute('data-control', 'link')
        await advance(5000)
        expect(login()).toHaveAttribute('data-control', 'link')
        expect(mockLogin).not.toHaveBeenCalled()
        expectEntryActions()
    })

    it.each(['unknown', 'hung'])('offers a quiet manual login at once after Android %s', async (outcome) => {
        if (outcome === 'unknown') mockAndroidCheck.mockResolvedValue('unknown')
        render(<Landing />)
        await flush()
        expect(login()).toHaveAttribute('data-control', 'link')
        expectEntryActions()
        expect(mockToastError).not.toHaveBeenCalled()
        fireEvent.click(login()!)
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockLogin).toHaveBeenCalledWith()
        await advance(5000)
        expect(login()).toHaveAttribute('data-control', 'link')
    })

    it.each(['available', 'unavailable'] as const)('ignores late Android %s results after timeout', async (outcome) => {
        const check = deferred<'available' | 'unavailable'>()
        mockAndroidCheck.mockReturnValue(check.promise)
        render(<Landing />)
        const signal = mockAndroidCheck.mock.calls[0][0] as AbortSignal
        expect(signal).toBeInstanceOf(AbortSignal)
        await advance(5000)
        expect(signal.aborted).toBe(true)
        await act(async () => check.resolve(outcome))
        expect(login()).toHaveAttribute('data-control', 'link')
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it('aborts the pending Android preparation when leaving the screen', async () => {
        const view = render(<Landing />)
        const signal = mockAndroidCheck.mock.calls[0][0] as AbortSignal
        expect(signal.aborted).toBe(false)
        view.unmount()
        expect(signal.aborted).toBe(true)
        await advance(5000)
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it('starts iOS automatic login once only after early confirmed capability and aborts on leaving', async () => {
        ios()
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
        expect(mockAndroidCheck).not.toHaveBeenCalled()
    })

    // A native request still pending at the deadline must not hold the fallback for the 60 s ceremony bound.
    function pendingAutoLogin() {
        ios()
        mockIOSCapability.mockResolvedValue(true)
        mockLogin.mockImplementationOnce(
            ({ cancelSignal }: { cancelSignal: AbortSignal }) =>
                new Promise<void>((_, reject) => {
                    cancelSignal.addEventListener('abort', () => {
                        mockIsLoggingIn = false
                        reject(new Error('CeremonyCancelledError'))
                    })
                })
        )
    }

    it('keeps Log in and Sign up usable while the iOS automatic login is still pending after the deadline', async () => {
        pendingAutoLogin()
        const view = render(<Landing />)
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(1)
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        await advance(5000)
        expect(login()).toHaveAttribute('data-control', 'link')
        expect(login()).toBeEnabled()
        expect(screen.getByRole('button', { name: 'landing.signUp' })).toBeEnabled()
    })

    it('Log in retires the pending automatic login and frees the native slot before the manual login starts', async () => {
        pendingAutoLogin()
        const view = render(<Landing />)
        await flush()
        const { cancelSignal } = mockLogin.mock.calls[0][0] as { cancelSignal: AbortSignal }
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        await advance(5000)
        const cancelled = deferred<void>()
        mockCancelIOS.mockReturnValueOnce(cancelled.promise)
        fireEvent.click(login()!)
        await flush()
        expect(cancelSignal.aborted).toBe(true)
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        // the manual request waits until the native slot is free
        expect(mockLogin).toHaveBeenCalledTimes(1)
        await act(async () => cancelled.resolve())
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(2)
        expect(mockLogin).toHaveBeenLastCalledWith()
        // a second tap while the manual login runs does not start another one
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        expect(login()).toBeDisabled()
    })

    it('Sign up retires the pending automatic login before leaving the landing', async () => {
        pendingAutoLogin()
        const view = render(<Landing />)
        await flush()
        const { cancelSignal } = mockLogin.mock.calls[0][0] as { cancelSignal: AbortSignal }
        mockIsLoggingIn = true
        view.rerender(<Landing />)
        await advance(5000)
        fireEvent.click(screen.getByRole('button', { name: 'landing.signUp' }))
        await flush()
        await flush()
        expect(cancelSignal.aborted).toBe(true)
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockLogin).toHaveBeenCalledTimes(1)
    })

    it('frees the native slot when the automatic attempt times out, so the next Log in is not refused', async () => {
        ios()
        mockIOSCapability.mockResolvedValue(true)
        // The native callback never arrives; the ceremony guard gives up at its 60 s bound.
        mockLogin.mockImplementationOnce(
            () =>
                new Promise<void>((_, reject) => {
                    setTimeout(() => {
                        mockIsLoggingIn = false
                        reject(new Error('CeremonyTimeoutError'))
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
        fireEvent.click(login()!)
        expect(mockLogin).toHaveBeenCalledTimes(2)
        expect(mockLogin).toHaveBeenLastCalledWith()
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
    })

    it('retires a pending automatic login when the landing unmounts, so its sheet cannot open over the next step', async () => {
        pendingAutoLogin()
        const view = render(<Landing />)
        await flush()
        const { cancelSignal } = mockLogin.mock.calls[0][0] as { cancelSignal: AbortSignal }
        view.unmount()
        expect(cancelSignal.aborted).toBe(true)
        expect(mockCancelIOS).toHaveBeenCalledTimes(1)
    })

    it('runs the iOS automatic login once per app launch, not again when the landing mounts again', async () => {
        ios()
        mockIOSCapability.mockResolvedValue(true)
        mockLogin.mockImplementation(() => new Promise(() => {}))
        const first = render(<Landing />)
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(1)
        first.unmount()
        render(<Landing />)
        await flush()
        await advance(5000)
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(login()).toHaveAttribute('data-control', 'link')
    })

    it('never starts the iOS automatic login after the user tapped Sign up, also on the next landing', async () => {
        ios()
        mockIOSCapability.mockResolvedValue(true)
        const view = render(<Landing />)
        fireEvent.click(screen.getByRole('button', { name: 'landing.signUp' }))
        await flush()
        view.unmount()
        render(<Landing />)
        await flush()
        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it('a manual login in flight still disables Log in when no automatic attempt is pending', async () => {
        ios()
        mockIOSCapability.mockResolvedValue(false)
        mockIsLoggingIn = true
        render(<Landing />)
        await flush()
        await advance(5000)
        expect(login()).toBeDisabled()
        expect(mockCancelIOS).not.toHaveBeenCalled()
    })

    it('keeps an ambiguous iOS rejection quiet and keeps the manual log in link', async () => {
        ios()
        mockIOSCapability.mockResolvedValue(true)
        mockLogin.mockRejectedValueOnce(new Error('ambiguous native failure'))
        render(<Landing />)
        await flush()
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(login()).toHaveAttribute('data-control', 'link')
        await advance(5000)
        expect(login()).toHaveAttribute('data-control', 'link')
        expect(mockToastError).not.toHaveBeenCalled()
        fireEvent.click(login()!)
        expect(mockLogin).toHaveBeenLastCalledWith()
    })

    it.each(['old bridge', 'unsupported', 'rejected', 'hung'])(
        'never automatically opens iOS UI for %s',
        async (outcome) => {
            ios()
            if (outcome === 'old bridge') mockNative.isNativeBridge = false
            if (outcome === 'unsupported') mockIOSCapability.mockResolvedValue(false)
            if (outcome === 'rejected') mockIOSCapability.mockRejectedValue(new Error('capability unavailable'))
            render(<Landing />)
            expect(login()).toHaveAttribute('data-control', 'link')
            await flush()
            await advance(5000)
            expect(login()).toHaveAttribute('data-control', 'link')
            expect(mockLogin).not.toHaveBeenCalled()
            expect(mockToastError).not.toHaveBeenCalled()
        }
    )

    it('does not auto-login after the wall-clock deadline even when the deadline timer has not fired', async () => {
        ios()
        const capability = deferred<boolean>()
        mockIOSCapability.mockReturnValue(capability.promise)
        render(<Landing />)
        jest.setSystemTime(Date.now() + 5001)
        await act(async () => capability.resolve(true))
        expect(mockLogin).not.toHaveBeenCalled()
    })

    function selectIOSFallback(action: 'signup' | 'recovery') {
        if (action === 'signup') fireEvent.click(screen.getByRole('button', { name: 'landing.signUp' }))
        else fireEvent.click(screen.getByText('landing.recoverWallet'))
    }

    it.each(['signup', 'recovery'] as const)(
        'does not start iOS auto-login after %s during capability lookup',
        async (action) => {
            ios()
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
            ios()
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
        ios()
        const capability = deferred<boolean>()
        mockIOSCapability.mockReturnValue(capability.promise)
        const view = render(<Landing />)
        await advance(5000)
        await act(async () => capability.resolve(true))
        expect(mockLogin).not.toHaveBeenCalled()
        expect(login()).toHaveAttribute('data-control', 'link')
        view.unmount()
        const secondCapability = deferred<boolean>()
        mockIOSCapability.mockReturnValue(secondCapability.promise)
        const secondView = render(<Landing />)
        secondView.unmount()
        await act(async () => secondCapability.resolve(true))
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it('preserves immediate full login for keep-web users without native probes', async () => {
        mockNative = {
            isCapacitor: false,
            isHydrated: true,
            isNativeBridge: false,
            isIOSNative: false,
            isAndroidNativeBridge: false,
            platform: 'web',
        }
        render(<Landing />)
        expect(login()).toHaveAttribute('data-control', 'full')
        expectEntryActions()
        await advance(5000)
        expect(mockAndroidCheck).not.toHaveBeenCalled()
        expect(mockIOSCapability).not.toHaveBeenCalled()
        expect(mockLogin).not.toHaveBeenCalled()
        fireEvent.click(login()!)
        expect(mockLogin).toHaveBeenCalledWith()
    })
})
