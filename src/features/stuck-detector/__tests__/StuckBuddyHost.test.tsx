import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import enMessages from '@/i18n/app/messages/en.json'
import { StuckBuddyHost } from '../components/StuckBuddyHost'
import { readStuckMemory } from '../memory'
import {
    evaluateIdleTick,
    getStuckRuntimeSnapshot,
    noteLocalVerifyFieldError,
    resetStuckRuntimeForTests,
    setDepositDetailsStepActive,
} from '../signalStore'
import { noteStuckAnalyticsEvent } from '../signalTap'

let mockPathname = '/verify'
let mockFlagEnabled = false
let mockOptedOut = false
const mockOpenSupportWithMessage = jest.fn()

jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('nuqs', () => ({
    parseAsString: 'string',
    useQueryStates: () => [{ country: null, view: null, stuck_demo: null }],
}))

jest.mock('framer-motion', () => {
    const stripMotionProps = ({
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        whileTap: _whileTap,
        ...rest
    }: Record<string, unknown>) => rest
    return {
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        useReducedMotion: () => true,
        motion: {
            aside: ({ children, ...props }: Record<string, unknown>) => (
                <aside {...stripMotionProps(props)}>{children as React.ReactNode}</aside>
            ),
            div: ({ children, ...props }: Record<string, unknown>) => (
                <div {...stripMotionProps(props)}>{children as React.ReactNode}</div>
            ),
            button: ({ children, ...props }: Record<string, unknown>) => (
                <button {...stripMotionProps(props)}>{children as React.ReactNode}</button>
            ),
        },
    }
})

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: jest.fn(),
        has_opted_out_capturing: jest.fn(() => mockOptedOut),
        get_session_replay_url: jest.fn(() => 'https://eu.posthog.com/replay/test'),
    },
}))

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: 'u-host-test', isActivated: false },
            residence: { verified: { country: 'AR' } },
        },
    }),
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContextOptional: () => ({
        openSupportWithMessage: mockOpenSupportWithMessage,
    }),
}))

jest.mock('@/hooks/useFeatureFlag', () => ({
    useFeatureFlags: () => (flag: string) => flag === 'stuck-buddy-interventions' && mockFlagEnabled,
}))

jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))

jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false }),
}))

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ balance: BigInt(0) }),
}))

jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

jest.mock('../components/PeanutBuddyMascot', () => ({
    PeanutBuddyMascot: () => <div data-testid="mock-mascot" />,
}))

const renderHost = () =>
    render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
            <StuckBuddyHost />
        </NextIntlClientProvider>
    )

describe('StuckBuddyHost invariants', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        window.localStorage.clear()
        resetStuckRuntimeForTests()
        mockPathname = '/verify'
        mockFlagEnabled = false
        mockOptedOut = false
    })

    it('logs control-arm stuck_buddy_eligible and checkpoint without rendering UI or writing localStorage when flag is off', () => {
        mockFlagEnabled = false
        renderHost()

        act(() => {
            noteLocalVerifyFieldError(3)
        })

        expect(screen.queryByTestId('peanut-buddy')).toBeNull()
        expect(window.localStorage.length).toBe(0)
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.STUCK_BUDDY_ELIGIBLE,
            expect.objectContaining({
                surface: 'verify_loop',
                reason: 'verify_field_loop',
                arm: 'control',
            })
        )
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.STUCK_SIGNAL_CHECKPOINT,
            expect.objectContaining({ checkpoint_s: 0, surface: 'verify_loop' })
        )
        // Control arm enforces the same once-per-session virtual cap as treatment.
        expect(getStuckRuntimeSnapshot().sessionNudgeShown).toBe(true)
    })

    it('persists dismissal cooldown even when analytics are opted out (never re-nags opted-out users)', () => {
        mockFlagEnabled = true
        mockOptedOut = true
        renderHost()

        act(() => {
            noteLocalVerifyFieldError(3)
        })

        expect(screen.getByTestId('peanut-buddy')).toBeTruthy()
        fireEvent.click(screen.getByTestId('peanut-buddy-dismiss'))

        const mem = readStuckMemory('u-host-test')
        expect(mem.lifetimeDismissCount).toBe(1)
        expect(mem.dismissedUntil.verify_loop).toBeGreaterThan(Date.now())
    })

    it('catches non-bubbling scroll inside #scrollable-content so scrolling resets idle (N2a)', () => {
        mockFlagEnabled = true
        mockPathname = '/home'
        const scroller = document.createElement('div')
        scroller.id = 'scrollable-content'
        document.body.appendChild(scroller)

        const { unmount } = renderHost()
        const t0 = getStuckRuntimeSnapshot().lastTickAt

        act(() => {
            evaluateIdleTick(t0 + 20_000)
        })
        expect(getStuckRuntimeSnapshot().activeIdleMs).toBe(20_000)

        // Dispatch a non-bubbling scroll event on an inner container (like AppShell's #scrollable-content).
        act(() => {
            scroller.dispatchEvent(new Event('scroll', { bubbles: false }))
        })
        expect(getStuckRuntimeSnapshot().activeIdleMs).toBe(0)

        unmount()
        scroller.remove()
    })

    it('records seenDepositDetailsUnfundedInSession only on leaving deposit details after >=10s dwell (N9, zero localStorage)', () => {
        mockFlagEnabled = false
        mockPathname = '/add-money/germany/bank'
        const { unmount } = renderHost()

        act(() => {
            setDepositDetailsStepActive(true)
            const t0 = getStuckRuntimeSnapshot().lastTickAt
            evaluateIdleTick(t0 + 12_000)
        })
        expect(getStuckRuntimeSnapshot().seenDepositDetailsUnfundedInSession).toBe(false)

        unmount()
        expect(getStuckRuntimeSnapshot().seenDepositDetailsUnfundedInSession).toBe(true)
        expect(window.localStorage.length).toBe(0)
    })

    it('redacts sensitive link secrets, logs to Sentry, and opens prefilled in-app SupportDrawer', () => {
        mockFlagEnabled = true
        mockPathname = '/card'
        renderHost()

        act(() => {
            noteStuckAnalyticsEvent(ANALYTICS_EVENTS.DEPOSIT_FAILED)
            noteStuckAnalyticsEvent(ANALYTICS_EVENTS.DEPOSIT_FAILED)
        })

        fireEvent.click(screen.getByTestId('peanut-buddy-cta'))
        fireEvent.change(screen.getByLabelText('Optional note'), {
            target: { value: 'Failed on https://peanut.me/claim#p=topsecret123' },
        })
        fireEvent.click(screen.getByTestId('stuck-bug-submit'))

        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'stuck-buddy bug report: payment_failed',
            expect.objectContaining({
                extra: expect.objectContaining({
                    note: 'Failed on https://peanut.me/claim',
                }),
            })
        )
        expect(mockOpenSupportWithMessage).toHaveBeenCalledWith(
            'Bug report (Payment failed) on /card: Failed on https://peanut.me/claim'
        )
    })
})
