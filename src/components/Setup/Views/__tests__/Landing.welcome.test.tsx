/** @jest-environment jsdom */
import React, { StrictMode, type ReactNode } from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import Landing from '../Landing'
import { SetupWrapper } from '../../components/SetupWrapper'

const FLAG = 'welcome-headline-copy'
const control = en.setup.steps.landing
const copies = {
    control: { title: control.title, description: control.description },
    every_border: {
        title: 'One account. Every border.',
        description: 'Receive, send and spend internationally, without paying for the distance.',
    },
    whole_world: {
        title: 'The whole world in one account.',
        description: 'Get paid in other currencies, pay anyone abroad, spend locally. No transfer fees.',
    },
    travels_free: {
        title: 'Money that travels free.',
        description: 'One account that sends, receives and spends across borders at no cost.',
    },
} as const
const mockGetFeatureFlag = jest.fn()
const mockCapture = jest.fn()
const mockRegister = jest.fn()
const mockSubscribe = jest.fn()
const mockUnsubscribe = jest.fn()
const mockNext = jest.fn()
const mockKnownCredentials = jest.fn()
let mockLoaded = true
let mockVariant: unknown = 'every_border'
let mockCallbacks: Array<() => void> = []
let mockKeepWeb = false
let mockNative = {
    isCapacitor: true,
    isHydrated: true,
    isNativeBridge: true,
    isIOSNative: false,
    isAndroidNative: true,
    isAndroidNativeBridge: true,
    platform: 'android-native',
}

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        getFeatureFlag: (...args: unknown[]) => mockGetFeatureFlag(...args),
        capture: (...args: unknown[]) => mockCapture(...args),
        register: (...args: unknown[]) => mockRegister(...args),
        onFeatureFlags: (callback: () => void) => mockSubscribe(callback),
        featureFlags: {
            get hasLoadedFlags() {
                return mockLoaded
            },
            getFlagVariants: () => ({ 'welcome-headline-copy': mockVariant }),
        },
    },
}))
jest.mock('@/components/Setup/setup-entry', () => ({
    ...jest.requireActual('@/components/Setup/setup-entry'),
    hasKnownDeviceCredentials: () => mockKnownCredentials(),
}))
jest.mock('@/utils/native-platform', () => ({ useNativePlatform: () => mockNative }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative.isCapacitor }))
// signup-draft's import chain calls isCapacitor() at load, before mockNative exists; no draft is stored here.
jest.mock('@/features/setup/signup-draft', () => ({ readSignupDraft: () => null, discardSignupDraft: jest.fn() }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => mockKeepWeb }))
jest.mock('@/hooks/useLogin', () => ({
    useLogin: () => ({ handleLoginClick: jest.fn(), isLoggingIn: false }),
}))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
        <button onClick={onClick} disabled={disabled}>
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
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
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
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/features/setup/useSignupControl', () => ({
    ...jest.requireActual('@/features/setup/useSignupControl'),
    useSignupControl: () => ({ track: jest.fn(), trackError: jest.fn() }),
}))
jest.mock('../LoginRecoveryDrawer', () => ({ LoginRecoveryDrawer: () => null }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    useDeviceType: () => ({ deviceType: 'web' }),
    DeviceType: { WEB: 'web' },
}))
jest.mock('@/components/Migration/StoreButtons', () => ({
    __esModule: true,
    default: () => <a href="https://example.test/store">Download the app</a>,
}))
jest.mock('@/utils/demo', () => ({ disableDemoMode: jest.fn() }))
jest.mock('@/i18n/app/locale-context', () => ({ useAppLocale: () => ({ locale: 'en', setLocale: jest.fn() }) }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <div data-testid="welcome-hero" />,
}))
jest.mock('../../components/OnboardingAnimation', () => ({ __esModule: true, default: () => null }))
// Reduced-motion users must receive the same immediate, settled copy without an animation wait.
jest.mock('framer-motion', () => ({ ...jest.requireActual('framer-motion'), useReducedMotion: () => true }))

function Welcome() {
    return (
        <SetupWrapper
            layoutType="signup"
            screenId="landing"
            image={{ pose: 'cheering' }}
            title={control.title}
            description={control.description}
        >
            <Landing />
        </SetupWrapper>
    )
}
const advance = async (milliseconds: number) => {
    await act(async () => {
        jest.advanceTimersByTime(milliseconds)
        await Promise.resolve()
    })
}
const notifyFlags = async () => {
    mockLoaded = true
    await act(async () => {
        mockCallbacks.forEach((callback) => callback())
        await Promise.resolve()
    })
}
function ancestors(element: HTMLElement) {
    const result: HTMLElement[] = []
    for (let current: HTMLElement | null = element; current; current = current.parentElement) result.push(current)
    return result
}
function isConcealed(element: HTMLElement) {
    return ancestors(element).some((current) => {
        const style = getComputedStyle(current)
        return (
            current.hidden ||
            current.getAttribute('aria-hidden') === 'true' ||
            current.classList.contains('invisible') ||
            current.classList.contains('hidden') ||
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
        )
    })
}
function expectCopy(variant: keyof typeof copies) {
    for (const text of Object.values(copies[variant])) {
        expect(screen.getAllByText(text).some((element) => !isConcealed(element))).toBe(true)
    }
    for (const [otherVariant, copy] of Object.entries(copies)) {
        if (otherVariant === variant) continue
        for (const text of Object.values(copy)) {
            expect(screen.queryAllByText(text).every((element) => isConcealed(element))).toBe(true)
        }
    }
}
const signup = () => screen.getByRole('button', { name: /sign up/i })
function expectClickVariant(variant: keyof typeof copies) {
    expect(mockRegister).toHaveBeenCalledWith({ welcome_variant: variant })
    expect(mockCapture).toHaveBeenCalledWith(
        'signup_signup_clicked',
        expect.objectContaining({ welcome_variant: variant })
    )
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.resetAllMocks()
    mockLoaded = true
    mockVariant = 'every_border'
    mockKeepWeb = false
    mockCallbacks = []
    mockNative = {
        isCapacitor: true,
        isHydrated: true,
        isNativeBridge: true,
        isIOSNative: false,
        isAndroidNative: true,
        isAndroidNativeBridge: true,
        platform: 'android-native',
    }
    mockKnownCredentials.mockReturnValue(false)
    mockGetFeatureFlag.mockImplementation(() => mockVariant)
    mockSubscribe.mockImplementation((callback: () => void) => {
        mockCallbacks.push(callback)
        return mockUnsubscribe
    })
})
afterEach(() => {
    cleanup()
    jest.useRealTimers()
})

describe('welcome headline public landing acceptance', () => {
    it.each(Object.keys(copies) as Array<keyof typeof copies>)(
        'shows exact loaded %s copy and exposes once',
        (variant) => {
            mockVariant = variant
            renderWithIntl(<Welcome />)
            expectCopy(variant)
            expect(mockGetFeatureFlag).toHaveBeenCalledTimes(1)
            expect(mockGetFeatureFlag).toHaveBeenCalledWith(FLAG)
            expect(screen.getByTestId('welcome-hero')).toBeInTheDocument()
            expect(signup()).toBeEnabled()
        }
    )

    it('reserves pending copy invisibly while hero and actions are immediately available', () => {
        mockLoaded = false
        renderWithIntl(<Welcome />)
        for (const text of [control.title, control.description]) {
            const reserved = screen.getAllByText(text)
            expect(reserved.length).toBeGreaterThan(0)
            for (const element of reserved) {
                expect(isConcealed(element)).toBe(true)
                for (const ancestor of ancestors(element)) {
                    expect(ancestor.hidden).toBe(false)
                    expect(ancestor).not.toHaveClass('hidden')
                    expect(getComputedStyle(ancestor).display).not.toBe('none')
                }
            }
        }
        expect(isConcealed(screen.getByTestId('welcome-hero'))).toBe(false)
        expect(isConcealed(signup())).toBe(false)
        expect(signup()).toBeEnabled()
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
    })

    it.each(Object.keys(copies) as Array<keyof typeof copies>)(
        'selects delayed %s at 1499 ms and never changes it',
        async (variant) => {
            mockLoaded = false
            mockVariant = variant
            const view = renderWithIntl(<Welcome />)
            await advance(1499)
            expect(mockGetFeatureFlag).not.toHaveBeenCalled()
            await notifyFlags()
            expectCopy(variant)
            mockVariant = variant === 'every_border' ? 'whole_world' : 'every_border'
            await notifyFlags()
            view.rerender(<Welcome />)
            await advance(5000)
            expectCopy(variant)
            expect(mockGetFeatureFlag).toHaveBeenCalledTimes(1)
        }
    )

    it('keeps the original 1500 ms budget when keep-web state changes during the wait', async () => {
        mockLoaded = false
        const view = renderWithIntl(<Welcome />)
        await advance(1000)
        mockKeepWeb = true
        view.rerender(<Welcome />)
        await advance(500)
        expectCopy('control')
        await notifyFlags()
        expectCopy('control')
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
    })

    it('reveals control at 1500 ms and ignores late callbacks', async () => {
        mockLoaded = false
        renderWithIntl(<Welcome />)
        await advance(1500)
        expectCopy('control')
        await notifyFlags()
        await notifyFlags()
        await advance(5000)
        expectCopy('control')
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
    })

    it.each([1500, 1501])(
        'rejects flags at wall-clock %s ms even before the timeout callback runs',
        async (elapsed) => {
            mockLoaded = false
            renderWithIntl(<Welcome />)
            jest.setSystemTime(Date.now() + elapsed)
            await notifyFlags()
            expectCopy('control')
            expect(mockGetFeatureFlag).not.toHaveBeenCalled()
        }
    )

    it.each([undefined, null, false, true, '', 'unknown', 'EVERY_BORDER', 1, {}])(
        'uses control without exposure for invalid cached value %p',
        (variant) => {
            mockVariant = variant
            renderWithIntl(<Welcome />)
            expectCopy('control')
            expect(mockGetFeatureFlag).not.toHaveBeenCalled()
        }
    )

    it('does not expose when credentials appear while flags are pending', async () => {
        mockLoaded = false
        renderWithIntl(<Welcome />)
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
        await advance(500)
        mockKnownCredentials.mockReturnValue(true)
        await notifyFlags()
        expectCopy('control')
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
    })

    it('known device credentials show control without any flag read', async () => {
        mockKnownCredentials.mockReturnValue(true)
        renderWithIntl(<Welcome />)
        expectCopy('control')
        await notifyFlags()
        await advance(1500)
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
    })

    it.each([false, true])('web with keep-web=%s shows control without reading the flag', async (keepWeb) => {
        mockKeepWeb = keepWeb
        mockNative = {
            ...mockNative,
            isCapacitor: false,
            isNativeBridge: false,
            isAndroidNative: false,
            isAndroidNativeBridge: false,
            platform: 'web',
        }
        renderWithIntl(<Welcome />)
        expectCopy('control')
        if (!keepWeb) expect(screen.getByRole('link', { name: 'Download the app' })).toBeInTheDocument()
        await notifyFlags()
        await advance(1500)
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
    })

    it('waits for native hydration before exposing a loaded flag', () => {
        mockNative.isHydrated = false
        const view = renderWithIntl(<Welcome />)
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
        mockNative.isHydrated = true
        view.rerender(<Welcome />)
        expectCopy('every_border')
        expect(mockGetFeatureFlag).toHaveBeenCalledTimes(1)
    })

    it('handles a synchronous subscription callback without duplicate exposure', async () => {
        mockLoaded = false
        mockSubscribe.mockImplementation((callback: () => void) => {
            mockCallbacks.push(callback)
            mockLoaded = true
            callback()
            return mockUnsubscribe
        })
        renderWithIntl(<Welcome />)
        await notifyFlags()
        expectCopy('every_border')
        expect(mockGetFeatureFlag).toHaveBeenCalledTimes(1)
    })

    it.each([true, false])(
        'StrictMode with flags loaded=%s exposes only once across replay and rerender',
        async (loaded) => {
            mockLoaded = loaded
            const view = renderWithIntl(
                <StrictMode>
                    <Welcome />
                </StrictMode>
            )
            if (!loaded) await notifyFlags()
            await notifyFlags()
            view.rerender(
                <StrictMode>
                    <Welcome />
                </StrictMode>
            )
            expectCopy('every_border')
            expect(mockGetFeatureFlag).toHaveBeenCalledTimes(1)
        }
    )

    it('unmount invalidates even a callback already queued by the SDK', async () => {
        mockLoaded = false
        const view = renderWithIntl(<Welcome />)
        expect(mockSubscribe).toHaveBeenCalled()
        view.unmount()
        await notifyFlags()
        await advance(5000)
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
        expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('a separate real mount receives one fresh assignment', () => {
        const first = renderWithIntl(<Welcome />)
        expectCopy('every_border')
        first.unmount()
        mockVariant = 'travels_free'
        renderWithIntl(<Welcome />)
        expectCopy('travels_free')
        expect(mockGetFeatureFlag).toHaveBeenCalledTimes(2)
    })

    it.each(Object.keys(copies) as Array<keyof typeof copies>)(
        'signup reports the displayed %s arm',
        async (variant) => {
            mockVariant = variant
            renderWithIntl(<Welcome />)
            fireEvent.click(signup())
            await act(async () => {
                await Promise.resolve()
            })
            expectClickVariant(variant)
            expect(mockNext).toHaveBeenCalledTimes(1)
            expect(mockGetFeatureFlag).toHaveBeenCalledTimes(1)
        }
    )

    it('signup while pending reports control and prevents any late exposure after exit', async () => {
        mockLoaded = false
        renderWithIntl(<Welcome />)
        fireEvent.click(signup())
        await act(async () => {
            await Promise.resolve()
        })
        expectClickVariant('control')
        expect(mockNext).toHaveBeenCalledTimes(1)
        await notifyFlags()
        await advance(5000)
        expect(mockGetFeatureFlag).not.toHaveBeenCalled()
    })
})
