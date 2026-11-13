/** @jest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import Landing from '../Landing'

const mockLogin = jest.fn()
const mockNext = jest.fn()
const mockToastError = jest.fn()
let mockIsLoggingIn = false
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
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => true }))
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
const login = () => screen.queryByRole('button', { name: 'landing.logIn' })
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
    mockLogin.mockResolvedValue(undefined)
    mockIsLoggingIn = false
})
afterEach(() => {
    cleanup()
    jest.useRealTimers()
})

describe('native landing log in', () => {
    it.each(['android', 'ios', 'old-ios', 'hydrating'])(
        'shows sign up, recovery and the secondary log in button at once on %s',
        (platform) => {
            if (platform.includes('ios')) ios()
            if (platform === 'old-ios') mockNative.isNativeBridge = false
            if (platform === 'hydrating') mockNative.isHydrated = false
            render(<Landing />)
            expectEntryActions()
            expect(login()).toHaveAttribute('data-control', 'full')
            expect(login()).toHaveAttribute('data-variant', 'secondary')
            expect(login()).toBeEnabled()
            expect(mockLogin).not.toHaveBeenCalled()
        }
    )

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
