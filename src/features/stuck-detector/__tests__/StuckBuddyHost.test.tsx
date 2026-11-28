import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import enMessages from '@/i18n/app/messages/en.json'
import { StuckBuddyHost } from '../components/StuckBuddyHost'
import { readStuckMemory } from '../memory'
import { noteLocalVerifyFieldError, resetStuckRuntimeForTests, setDepositDetailsStepActive } from '../signalStore'

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

    it('records seenAddMoneyUnfunded only on leaving deposit details (not on first entry)', () => {
        mockFlagEnabled = true
        mockPathname = '/add-money/germany/bank'
        const { unmount } = renderHost()

        act(() => {
            setDepositDetailsStepActive(true)
        })
        // First visit while still on screen: NOT yet marked seenAddMoneyUnfunded.
        expect(readStuckMemory('u-host-test').seenAddMoneyUnfunded).toBe(false)

        unmount()
        // After leaving with verified $0 balance: marked for future visit.
        expect(readStuckMemory('u-host-test').seenAddMoneyUnfunded).toBe(true)
    })

    it('redacts sensitive link secrets from bug report notes before sending to Sentry', () => {
        mockFlagEnabled = true
        mockPathname = '/card'
        renderHost()

        act(() => {
            noteLocalVerifyFieldError(1)
        })
        // Trigger active_issue via 2 error retries.
        act(() => {
            const { noteStuckAnalyticsEvent } = require('../signalTap')
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
    })
})
