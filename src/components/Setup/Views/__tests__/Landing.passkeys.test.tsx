/** @jest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import Landing from '../Landing'

const mockLogin = jest.fn()
const mockNext = jest.fn()
const mockToastError = jest.fn()
const mockCancelPending = jest.fn()
let mockIsLoggingIn = false
const nativePlatform = (platform: 'android' | 'ios') => ({
    isCapacitor: true,
    isHydrated: true,
    isNativeBridge: true,
    isIOSNative: platform === 'ios',
    isAndroidNative: platform === 'android',
    isAndroidNativeBridge: platform === 'android',
    platform: `${platform}-native`,
})
let mockNative = nativePlatform('android')

jest.mock('@/hooks/useLogin', () => ({
    useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: mockIsLoggingIn }),
}))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/features/setup/SetupFlowContext', () => ({ useOptionalSetupFlow: () => null }))
jest.mock('@/features/setup/signup-draft', () => ({ readSignupDraft: () => null, discardSignupDraft: jest.fn() }))
jest.mock('@/features/setup/WelcomeHeadlineExperimentProvider', () => ({
    useWelcomeHeadlineExperiment: () => ({ variant: 'control', cancelPending: mockCancelPending }),
}))
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
jest.mock('../../components/SetupFooter', () => {
    const Footer = ({
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
    )
    return { __esModule: true, default: Footer, SetupFooter: Footer }
})
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
const login = () => screen.getByRole('button', { name: 'logIn' })
const signup = () => screen.getByRole('button', { name: 'landing.signUp' })
const expectEntryActions = () => {
    expect(signup()).toBeEnabled()
    expect(login()).toBeEnabled()
    expect(login()).toHaveAttribute('data-control', 'full')
    expect(login()).toHaveAttribute('data-variant', 'secondary')
    expect(signup().compareDocumentPosition(login()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('landing.recoverWallet')).not.toBeInTheDocument()
}
function web() {
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

beforeEach(() => {
    jest.useFakeTimers()
    jest.resetAllMocks()
    mockNative = nativePlatform('android')
    mockLogin.mockResolvedValue(undefined)
    mockIsLoggingIn = false
})
afterEach(() => {
    cleanup()
    jest.clearAllTimers()
    jest.useRealTimers()
})

describe('native landing requires an explicit Log in tap', () => {
    it.each([
        ['android', 'android', true, true],
        ['ios', 'ios', true, true],
        ['old Android bridge', 'android', false, true],
        ['old iOS bridge', 'ios', false, true],
        ['hydrating Android', 'android', true, false],
        ['hydrating iOS', 'ios', true, false],
    ] as const)('shows the full secondary Log in below Sign up immediately on %s', (_, platform, bridge, hydrated) => {
        mockNative = { ...nativePlatform(platform), isNativeBridge: bridge, isHydrated: hydrated }
        render(<Landing />)

        expectEntryActions()
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it.each(['android', 'ios'] as const)('keeps %s actions stable at five and ten seconds without logging in', async (platform) => {
        mockNative = nativePlatform(platform)
        render(<Landing />)
        const initialLogin = login()
        const initialSignup = signup()

        for (const milliseconds of [5000, 5000]) {
            await advance(milliseconds)
            expectEntryActions()
            expect(login()).toBe(initialLogin)
            expect(signup()).toBe(initialSignup)
            expect(mockLogin).not.toHaveBeenCalled()
            expect(mockToastError).not.toHaveBeenCalled()
        }
    })

    it.each(['android', 'ios'] as const)('does not log in when %s hydration finishes or Landing rerenders', async (platform) => {
        mockNative = { ...nativePlatform(platform), isHydrated: false }
        const view = render(<Landing />)
        expectEntryActions()

        mockNative = { ...mockNative, isHydrated: true }
        view.rerender(<Landing />)
        await advance(5000)
        view.rerender(<Landing />)
        await advance(5000)

        expectEntryActions()
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it('does not log in on iOS unmount, remount, or a late timer after unmount', async () => {
        mockNative = nativePlatform('ios')
        const first = render(<Landing />)
        first.unmount()
        await advance(10_000)
        expect(mockLogin).not.toHaveBeenCalled()

        const second = render(<Landing />)
        expectEntryActions()
        await advance(10_000)
        expect(mockLogin).not.toHaveBeenCalled()
        second.unmount()
        await advance(10_000)
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it.each(['android', 'ios'] as const)('starts %s login once, without options, only after a manual tap', async (platform) => {
        mockNative = nativePlatform(platform)
        render(<Landing />)
        await advance(10_000)
        expect(mockLogin).not.toHaveBeenCalled()

        await act(async () => fireEvent.click(login()))
        expect(mockLogin.mock.calls).toEqual([[]])
        await advance(10_000)
        expect(mockLogin.mock.calls).toEqual([[]])
        expect(mockNext).not.toHaveBeenCalled()
    })

    it.each(['android', 'ios'] as const)('starts signup immediately on %s and never starts login afterward', async (platform) => {
        mockNative = nativePlatform(platform)
        const view = render(<Landing />)
        await act(async () => fireEvent.click(signup()))

        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockLogin).not.toHaveBeenCalled()
        await advance(10_000)
        view.rerender(<Landing />)
        expect(mockLogin).not.toHaveBeenCalled()
    })

    it.each(['android', 'ios'] as const)('disables both %s actions for an in-flight manual login and restores them afterward', async (platform) => {
        mockNative = nativePlatform(platform)
        let resolveLogin!: () => void
        mockLogin.mockReturnValueOnce(new Promise<void>((resolve) => (resolveLogin = resolve)))
        const view = render(<Landing />)
        fireEvent.click(login())
        expect(mockLogin.mock.calls).toEqual([[]])

        mockIsLoggingIn = true
        view.rerender(<Landing />)
        expect(login()).toBeDisabled()
        expect(signup()).toBeDisabled()
        fireEvent.click(login())
        fireEvent.click(signup())
        await advance(10_000)
        expect(mockLogin.mock.calls).toEqual([[]])
        expect(mockNext).not.toHaveBeenCalled()

        await act(async () => resolveLogin())
        mockIsLoggingIn = false
        view.rerender(<Landing />)
        expectEntryActions()
    })
})

describe('keep-web landing', () => {
    it('shows both full actions immediately and logs in only on a manual tap without options', async () => {
        web()
        render(<Landing />)
        expectEntryActions()
        await advance(10_000)
        expect(mockLogin).not.toHaveBeenCalled()

        await act(async () => fireEvent.click(login()))
        expect(mockLogin.mock.calls).toEqual([[]])
    })

    it('keeps Sign up enabled while a manual login is in flight', async () => {
        web()
        let resolveLogin!: () => void
        mockLogin.mockReturnValueOnce(new Promise<void>((resolve) => (resolveLogin = resolve)))
        const view = render(<Landing />)
        fireEvent.click(login())
        mockIsLoggingIn = true
        view.rerender(<Landing />)

        expect(login()).toBeDisabled()
        expect(signup()).toBeEnabled()
        await act(async () => fireEvent.click(signup()))
        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockLogin.mock.calls).toEqual([[]])
        await act(async () => resolveLogin())
    })
})
