// useSetupStepAnalytics — SIGNUP_STEP_VIEWED is the ONLY per-screen signal in
// the single-pageview signup flow, so a regression here fails silently in
// PostHog rather than in CI. These assertions are ported from the deleted
// useSetupStepUrlSync spec (the URL-mirroring half died with the stepper
// migration; the capture half lives on here — Chip review, PR #2949 round 3).
import { renderHook } from '@testing-library/react'
import posthog from 'posthog-js'
import { useSetupStepAnalytics } from '@/features/setup/useSetupStepAnalytics'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { type ISetupStep } from '@/components/Setup/Setup.types'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

const mockedCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>

const steps = [
    { screenId: 'landing' },
    { screenId: 'welcome', showBackButton: true },
    { screenId: 'signup', showBackButton: true },
    { screenId: 'sign-test-transaction' },
] as unknown as ISetupStep[]

const stepById = (screenId: string) => steps.find((s) => s.screenId === screenId)

const render = (initial: { enabled: boolean; step: ISetupStep | undefined }) =>
    renderHook(
        ({ enabled, step }: { enabled: boolean; step: ISetupStep | undefined }) =>
            useSetupStepAnalytics({ enabled, step, steps }),
        { initialProps: initial }
    )

beforeEach(() => {
    jest.clearAllMocks()
})

describe('useSetupStepAnalytics', () => {
    it('does nothing while disabled (entry step not yet rendered)', () => {
        render({ enabled: false, step: stepById('landing') })
        expect(mockedCapture).not.toHaveBeenCalled()
    })

    it('captures the entry step as nav_type initial', () => {
        render({ enabled: true, step: stepById('landing') })
        expect(mockedCapture).toHaveBeenCalledTimes(1)
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
            screen_id: 'landing',
            step_index: 1,
            total_steps: steps.length,
            nav_type: 'initial',
        })
    })

    it('an advance to the NEXT step captures nav_type forward', () => {
        const { rerender } = render({ enabled: true, step: stepById('landing') })
        rerender({ enabled: true, step: stepById('welcome') })
        expect(mockedCapture).toHaveBeenLastCalledWith(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
            screen_id: 'welcome',
            step_index: 2,
            total_steps: steps.length,
            nav_type: 'forward',
        })
    })

    it('a move to an EARLIER step captures nav_type back', () => {
        const { rerender } = render({ enabled: true, step: stepById('signup') })
        rerender({ enabled: true, step: stepById('welcome') })
        expect(mockedCapture).toHaveBeenLastCalledWith(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
            screen_id: 'welcome',
            step_index: 2,
            total_steps: steps.length,
            nav_type: 'back',
        })
    })

    it('a skip past the next step captures nav_type jump', () => {
        const { rerender } = render({ enabled: true, step: stepById('landing') })
        rerender({ enabled: true, step: stepById('signup') })
        expect(mockedCapture).toHaveBeenLastCalledWith(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
            screen_id: 'signup',
            step_index: 3,
            total_steps: steps.length,
            nav_type: 'jump',
        })
    })

    it('a re-render of the SAME screen emits nothing — funnels must not double-count', () => {
        const { rerender } = render({ enabled: true, step: stepById('landing') })
        rerender({ enabled: true, step: stepById('landing') })
        rerender({ enabled: true, step: stepById('landing') })
        expect(mockedCapture).toHaveBeenCalledTimes(1)
    })
})
