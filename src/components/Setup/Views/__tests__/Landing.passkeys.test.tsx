/** @jest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import Landing from '../Landing'

import { HAS_LOGGED_IN_ON_DEVICE_KEY, markLoggedInOnDevice } from '@/utils/device-login-history'

const mockCheck = jest.fn()
jest.mock('@/utils/landing-passkeys', () => ({
    checkAndroidLandingPasskey: (signal: AbortSignal) => mockCheck(signal),
}))

const mockLogin = jest.fn()
const mockNext = jest.fn()
const mockToastError = jest.fn()
let mockIsLoggingIn = false
let mockKeepWebBypass = true
const originalCapacitorBuild = process.env.NEXT_PUBLIC_CAPACITOR_BUILD
let mockNative = {
    isCapacitor: true,
    isHydrated: true,
    isNativeBridge: true,
    isIOSNative: false,
    isAndroidNativeBridge: true,
    isAndroidNative: true,
    platform: 'android',
}

jest.mock('@/hooks/useLogin', () => ({
    useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: mockIsLoggingIn }),
}))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/utils/native-platform', () => ({ useNativePlatform: () => mockNative }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
        variant,
    }: {
        children: ReactNode
        onClick?: () => void
        disabled?: boolean
        variant?: string
    }) => (
        <button data-control="full" data-variant={variant} onClick={onClick} disabled={disabled}>
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
    SetupDocLink: ({ children, href }: { children: ReactNode; href?: string }) => <a href={href}>{children}</a>,
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/features/setup/useSignupControl', () => ({ useSignupControl: () => ({ track: jest.fn() }) }))
jest.mock('../LoginRecoveryDrawer', () => ({ LoginRecoveryDrawer: () => null }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => mockKeepWebBypass }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    useDeviceType: () => ({ deviceType: 'web' }),
    DeviceType: { WEB: 'web' },
}))
jest.mock('@/components/Migration/StoreButtons', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/demo', () => ({ disableDemoMode: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

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
    mockNative = {
        ...mockNative,
        platform: 'ios',
        isIOSNative: true,
        isAndroidNative: false,
        isAndroidNativeBridge: false,
    }
}

// Jest does not load Tailwind CSS; provide the utility used for the invisible slot.
beforeAll(() => {
    const style = document.createElement('style')
    style.textContent = '.invisible { visibility: hidden; }'
    document.head.appendChild(style)
})

beforeEach(() => {
    jest.useFakeTimers()
    jest.resetAllMocks()
    localStorage.removeItem(HAS_LOGGED_IN_ON_DEVICE_KEY)
    mockCheck.mockImplementation(() => new Promise(() => {}))
    mockNative = {
        isCapacitor: true,
        isHydrated: true,
        isNativeBridge: true,
        isIOSNative: false,
        isAndroidNativeBridge: true,
        isAndroidNative: true,
        platform: 'android',
    }
    mockLogin.mockResolvedValue(undefined)
    mockIsLoggingIn = false
    mockKeepWebBypass = true
})
afterEach(() => {
    cleanup()
    if (originalCapacitorBuild === undefined) delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
    else process.env.NEXT_PUBLIC_CAPACITOR_BUILD = originalCapacitorBuild
    jest.useRealTimers()
})

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}
function expectPending(container: HTMLElement) {
    expect(login()).not.toBeInTheDocument()
    const placeholder = container.querySelector('[data-testid="landing-login-placeholder"]')
    expect(placeholder).not.toBeNull()
    expect(placeholder).toHaveAttribute('aria-hidden', 'true')
    expect(placeholder).toHaveClass('h-11')
    expect(placeholder).not.toBeVisible()
    expect(placeholder?.querySelector('button, a, input, [tabindex="0"]')).toBeNull()
}

describe('native landing log in', () => {
    it.each(['ios', 'old-ios'])('shows full login immediately on %s', (platform) => {
        ios()
        if (platform === 'old-ios') mockNative.isNativeBridge = false
        render(<Landing />)
        expectEntryActions()
        expect(login()).toHaveAttribute('data-control', 'full')
        expect(mockCheck).not.toHaveBeenCalled()
    })

    it('uses device history immediately without probing', () => {
        markLoggedInOnDevice()
        render(<Landing />)
        expect(login()).toHaveAttribute('data-control', 'full')
        expect(mockCheck).not.toHaveBeenCalled()
        expectEntryActions()
    })

    it.each(['available', 'unavailable', 'unknown', 'rejection'])('settles %s immediately', async (outcome) => {
        const pending = deferred<string>()
        mockCheck.mockReturnValue(pending.promise)
        const { container } = render(<Landing />)
        expectPending(container)
        expectEntryActions()
        await act(async () => {
            if (outcome === 'rejection') pending.reject(new Error('old binary'))
            else pending.resolve(outcome)
        })
        expect(login()).toHaveAttribute('data-control', outcome === 'unavailable' ? 'link' : 'full')
        if (outcome === 'unavailable') expect(login()?.closest('.pt-2')).not.toBeNull()
        expect(mockLogin).not.toHaveBeenCalled()
        expect(mockToastError).not.toHaveBeenCalled()
    })

    it('stays pending at 2999ms, shows full at 3000ms and ignores a late unavailable answer', async () => {
        const pending = deferred<string>()
        mockCheck.mockReturnValue(pending.promise)
        const { container } = render(<Landing />)
        await advance(2999)
        expectPending(container)
        await advance(1)
        expect(login()).toHaveAttribute('data-control', 'full')
        await act(async () => pending.resolve('unavailable'))
        expect(login()).toHaveAttribute('data-control', 'full')
        expect(mockCheck).toHaveBeenCalledTimes(1)
    })

    it('ignores unavailable arriving after the wall-clock deadline before timeout delivery', async () => {
        const startedAt = Date.now()
        const pending = deferred<string>()
        mockCheck.mockReturnValue(pending.promise)
        const view = render(<Landing />)
        expectPending(view.container)
        jest.setSystemTime(startedAt + 3001)
        await act(async () => pending.resolve('unavailable'))
        expect(login()).toHaveAttribute('data-control', 'full')
        expect(mockCheck).toHaveBeenCalledTimes(1)
    })

    it('aborts on cleanup without warnings and starts a fresh check on remount', async () => {
        const pending = deferred<string>()
        mockCheck.mockReturnValueOnce(pending.promise)
        const warning = jest.spyOn(console, 'error').mockImplementation(() => {})
        const first = render(<Landing />)
        const signal = mockCheck.mock.calls[0][0] as AbortSignal
        first.unmount()
        expect(signal.aborted).toBe(true)
        await act(async () => pending.resolve('unavailable'))
        const second = render(<Landing />)
        expect(mockCheck).toHaveBeenCalledTimes(2)
        expectPending(second.container)
        expect(warning).not.toHaveBeenCalled()
        warning.mockRestore()
    })

    it('rereads history on remount', () => {
        const first = render(<Landing />)
        first.unmount()
        markLoggedInOnDevice()
        render(<Landing />)
        expect(login()).toHaveAttribute('data-control', 'full')
        expect(mockCheck).toHaveBeenCalledTimes(1)
    })

    it('keeps native prehydration inert and checks only after hydration', () => {
        mockNative.isHydrated = false
        const view = render(<Landing />)
        expectPending(view.container)
        expect(mockCheck).not.toHaveBeenCalled()
        mockNative.isHydrated = true
        view.rerender(<Landing />)
        expect(mockCheck).toHaveBeenCalledTimes(1)
    })

    it('keeps an iOS native build inert before hydration, then shows full login without checking', () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        ios()
        mockNative.isHydrated = false
        const view = render(<Landing />)
        expectPending(view.container)
        expect(mockCheck).not.toHaveBeenCalled()
        mockNative.isHydrated = true
        view.rerender(<Landing />)
        expect(login()).toHaveAttribute('data-control', 'full')
        expect(mockCheck).not.toHaveBeenCalled()
    })

    it('reserves the native-build slot for a server web snapshot until Android hydration', () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        mockKeepWebBypass = false
        mockNative = {
            isCapacitor: false,
            isHydrated: false,
            isNativeBridge: false,
            isIOSNative: false,
            isAndroidNativeBridge: false,
            isAndroidNative: false,
            platform: 'web',
        }
        const view = render(<Landing />)
        expectPending(view.container)
        expect(mockCheck).not.toHaveBeenCalled()
        mockNative = {
            ...mockNative,
            isCapacitor: true,
            isHydrated: true,
            isNativeBridge: true,
            isAndroidNativeBridge: true,
            isAndroidNative: true,
            platform: 'android',
        }
        view.rerender(<Landing />)
        expectPending(view.container)
        expect(mockCheck).toHaveBeenCalledTimes(1)
    })

    it.each(['available', 'unavailable'])('disables the %s login and native signup during login', async (outcome) => {
        mockCheck.mockResolvedValue(outcome)
        mockIsLoggingIn = true
        render(<Landing />)
        await advance(0)
        expect(login()).toBeDisabled()
        expect(screen.getByRole('button', { name: 'landing.signUp' })).toBeDisabled()
        fireEvent.click(login()!)
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it('starts no passkey ceremony on iOS until Log in is tapped', async () => {
        ios()
        render(<Landing />)
        await advance(10_000)
        expect(mockLogin).not.toHaveBeenCalled()
        expect(mockToastError).not.toHaveBeenCalled()
        fireEvent.click(login()!)
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockLogin).toHaveBeenCalledWith()
    })

    it('disables Log in and Sign up on native while a login is in flight', () => {
        ios()
        mockIsLoggingIn = true
        render(<Landing />)
        expect(login()).toBeDisabled()
        expect(screen.getByRole('button', { name: 'landing.signUp' })).toBeDisabled()
    })

    it('keeps Sign up usable on the web while a login is in flight', () => {
        mockNative = {
            isCapacitor: false,
            isHydrated: true,
            isNativeBridge: false,
            isIOSNative: false,
            isAndroidNativeBridge: false,
            isAndroidNative: false,
            platform: 'web',
        }
        mockIsLoggingIn = true
        render(<Landing />)
        expect(login()).toBeDisabled()
        expect(screen.getByRole('button', { name: 'landing.signUp' })).toBeEnabled()
    })

    it('shows the full Log in button for keep-web users and starts login only on tap', async () => {
        mockNative = {
            isCapacitor: false,
            isHydrated: true,
            isNativeBridge: false,
            isIOSNative: false,
            isAndroidNativeBridge: false,
            isAndroidNative: false,
            platform: 'web',
        }
        render(<Landing />)
        expect(login()).toHaveAttribute('data-control', 'full')
        expectEntryActions()
        await advance(5000)
        expect(mockLogin).not.toHaveBeenCalled()
        fireEvent.click(login()!)
        expect(mockLogin).toHaveBeenCalledWith()
    })
})
