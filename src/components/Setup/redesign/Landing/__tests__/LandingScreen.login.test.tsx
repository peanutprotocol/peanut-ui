/** @jest-environment jsdom */
// Contract P1 (01 Landing): the log-in start and the sign-up draft rule. Checks P1-06…P1-13.
// Ported from Views/__tests__/Landing.passkeys.test.tsx and Landing.test.tsx ("draft ownership").
jest.mock('@/hooks/useLogin', () => require('./landing-state').useLoginModule())
jest.mock('@/hooks/useSetupFlow', () => require('./landing-state').useSetupFlowModule())
jest.mock('@/features/setup/SetupFlowContext', () => require('./landing-state').setupFlowContextModule())
jest.mock('@/features/setup/signup-draft', () => require('./landing-state').signupDraftModule())
jest.mock('@/utils/capacitor', () => require('./landing-state').capacitorModule())
jest.mock('@/utils/native-platform', () => require('./landing-state').nativePlatformModule())
jest.mock('@/hooks/useGetDeviceType', () => require('./landing-state').deviceTypeModule())
jest.mock('@/hooks/useKeepWebBypass', () => require('./landing-state').keepWebModule())
jest.mock('@/constants/migration.consts', () => require('./landing-state').migrationModule())
jest.mock('@/components/Migration/StoreButtons', () => require('./landing-state').storeButtonsModule())
jest.mock('@/components/0_Bruddle/Toast', () => require('./landing-state').toastModule())
jest.mock('@sentry/nextjs', () => require('./landing-state').sentryModule())
jest.mock('@/utils/sentry-lazy', () => require('./landing-state').sentryModule())
jest.mock('posthog-js', () => require('./landing-state').posthogModule())
jest.mock('lottie-web/build/player/lottie_light', () => require('./landing-state').lottieModule())
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () =>
    require('./landing-state').languageSwitcherModule()
)

import { act, fireEvent, within } from '@testing-library/react'
import { LandingScreen } from '@/components/Setup/redesign/Landing/LandingScreen'
import { enableDemoMode, isDemoMode } from '@/utils/demo'
import { landing, resetLanding, setPlatform } from './landing-state'
import { logInButton, signUpButton } from './landing-helpers'
import { renderInShell } from './redesign-harness'

const advance = async (milliseconds: number) => {
    await act(async () => {
        jest.advanceTimersByTime(milliseconds)
        await Promise.resolve()
    })
}
const expectEntryActions = () => {
    expect(signUpButton()).toBeEnabled()
    expect(logInButton()).toBeEnabled()
    expect(signUpButton().compareDocumentPosition(logInButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
}

beforeEach(() => {
    jest.useFakeTimers()
    resetLanding()
    window.localStorage.clear()
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

describe('01 Landing — log in only on a tap (K4, K5)', () => {
    it.each(['iphone', 'android'] as const)(
        'P1-06 %s: no login after 10 s, a hydration flip, rerenders, or an unmount and remount',
        async (platform) => {
            setPlatform(platform)
            landing.hydrated = false
            const view = renderInShell('landing', <LandingScreen />)
            expectEntryActions()
            await advance(5000)
            landing.hydrated = true
            view.rerenderInShell(<LandingScreen />)
            await advance(5000)
            view.rerenderInShell(<LandingScreen />)
            expectEntryActions()
            expect(landing.login).not.toHaveBeenCalled()

            view.unmount()
            await advance(10_000)
            const second = renderInShell('landing', <LandingScreen />)
            expectEntryActions()
            await advance(10_000)
            second.unmount()
            await advance(10_000)
            expect(landing.login).not.toHaveBeenCalled()
        }
    )

    it.each(['iphone', 'android'] as const)(
        'P1-07 %s: one Log in tap starts one login with no arguments, still one 10 s later, and does not advance',
        async (platform) => {
            setPlatform(platform)
            renderInShell('landing', <LandingScreen />)
            await act(async () => fireEvent.click(logInButton()))
            expect(landing.login.mock.calls).toEqual([[]])
            await advance(10_000)
            expect(landing.login.mock.calls).toEqual([[]])
            expect(landing.next).not.toHaveBeenCalled()
        }
    )

    it.each(['iphone', 'android'] as const)(
        'P1-08 %s, login in flight: Log in disabled with its spinner, Sign up disabled, taps do nothing; both return after',
        async (platform) => {
            setPlatform(platform)
            let resolveLogin!: () => void
            landing.login.mockReturnValueOnce(new Promise<void>((resolve) => (resolveLogin = resolve)))
            const view = renderInShell('landing', <LandingScreen />)
            fireEvent.click(logInButton())
            expect(landing.login.mock.calls).toEqual([[]])

            landing.isLoggingIn = true
            view.rerenderInShell(<LandingScreen />)
            expect(logInButton()).toBeDisabled()
            expect(within(logInButton()).getByRole('status')).toBeInTheDocument()
            expect(signUpButton()).toBeDisabled()
            fireEvent.click(logInButton())
            fireEvent.click(signUpButton())
            await advance(10_000)
            expect(landing.login.mock.calls).toEqual([[]])
            expect(landing.next).not.toHaveBeenCalled()

            await act(async () => resolveLogin())
            landing.isLoggingIn = false
            view.rerenderInShell(<LandingScreen />)
            expectEntryActions()
            expect(within(logInButton()).queryByRole('status')).not.toBeInTheDocument()
        }
    )

    it('P1-09 keep-web, login in flight: Log in disabled, Sign up stays enabled and advances once', async () => {
        setPlatform('keep-web')
        let resolveLogin!: () => void
        landing.login.mockReturnValueOnce(new Promise<void>((resolve) => (resolveLogin = resolve)))
        const view = renderInShell('landing', <LandingScreen />)
        fireEvent.click(logInButton())
        landing.isLoggingIn = true
        view.rerenderInShell(<LandingScreen />)

        expect(logInButton()).toBeDisabled()
        expect(signUpButton()).toBeEnabled()
        await act(async () => fireEvent.click(signUpButton()))
        expect(landing.next).toHaveBeenCalledTimes(1)
        expect(landing.login.mock.calls).toEqual([[]])
        await act(async () => resolveLogin())
    })

    it('P1-10 mounting the landing switches demo mode off', () => {
        enableDemoMode()
        expect(isDemoMode()).toBe(true)
        renderInShell('landing', <LandingScreen />)
        expect(isDemoMode()).toBe(false)
    })
})

describe('01 Landing — Sign up and the draft (K3)', () => {
    it('P1-11 a draft owned by an account is discarded and the flow reset, both before the next step', () => {
        landing.draft = { userId: 'previous-account' }
        renderInShell('landing', <LandingScreen />)
        fireEvent.click(signUpButton())

        expect(landing.discard).toHaveBeenCalledTimes(1)
        expect(landing.reset).toHaveBeenCalledTimes(1)
        expect(landing.next).toHaveBeenCalledTimes(1)
        expect(landing.discard.mock.invocationCallOrder[0]).toBeLessThan(landing.next.mock.invocationCallOrder[0])
        expect(landing.reset.mock.invocationCallOrder[0]).toBeLessThan(landing.next.mock.invocationCallOrder[0])
    })

    it('P1-12 an anonymous draft is kept: Sign up advances once without discarding or resetting', () => {
        landing.draft = {}
        renderInShell('landing', <LandingScreen />)
        fireEvent.click(signUpButton())

        expect(landing.next).toHaveBeenCalledTimes(1)
        expect(landing.discard).not.toHaveBeenCalled()
        expect(landing.reset).not.toHaveBeenCalled()
    })

    it('P1-13 Log in never discards an account-owned draft', async () => {
        landing.draft = { userId: 'previous-account' }
        renderInShell('landing', <LandingScreen />)
        await act(async () => fireEvent.click(logInButton()))

        expect(landing.login).toHaveBeenCalledTimes(1)
        expect(landing.discard).not.toHaveBeenCalled()
        expect(landing.reset).not.toHaveBeenCalled()
    })
})
