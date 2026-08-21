import { renderHook, act } from '@testing-library/react'
import posthog from 'posthog-js'
import { useSetupStepUrlSync } from '@/hooks/useSetupStepUrlSync'
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

const render = (initial: { enabled: boolean; step: ISetupStep | undefined; goToScreen?: jest.Mock }) => {
    const goToScreen = initial.goToScreen ?? jest.fn()
    const view = renderHook(
        ({ enabled, step }: { enabled: boolean; step: ISetupStep | undefined }) =>
            useSetupStepUrlSync({ enabled, step, steps, goToScreen }),
        { initialProps: { enabled: initial.enabled, step: initial.step } }
    )
    return { ...view, goToScreen }
}

const popTo = (screenId: string) => {
    act(() => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: { setupScreen: screenId } }))
    })
}

describe('useSetupStepUrlSync', () => {
    beforeEach(() => {
        // restore first: spyOn on an already-spied method returns the old spy,
        // which would leak call history recorded before a test attaches it
        jest.restoreAllMocks()
        jest.clearAllMocks()
        window.history.replaceState(null, '', '/setup')
    })

    it('does nothing while disabled', () => {
        render({ enabled: false, step: stepById('landing') })
        expect(mockedCapture).not.toHaveBeenCalled()
        expect(window.location.search).toBe('')
    })

    it('captures the entry step and canonicalizes the URL without growing history', () => {
        const replaceSpy = jest.spyOn(window.history, 'replaceState')
        const pushSpy = jest.spyOn(window.history, 'pushState')
        render({ enabled: true, step: stepById('landing') })

        expect(mockedCapture).toHaveBeenCalledTimes(1)
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
            screen_id: 'landing',
            step_index: 1,
            total_steps: steps.length,
            nav_type: 'initial',
        })
        expect(window.location.search).toBe('?screen=landing')
        expect(replaceSpy).toHaveBeenCalled()
        expect(pushSpy).not.toHaveBeenCalled()
    })

    it('pushes a history entry and captures nav_type forward on step advance', () => {
        const { rerender } = render({ enabled: true, step: stepById('landing') })
        const pushSpy = jest.spyOn(window.history, 'pushState')

        rerender({ enabled: true, step: stepById('welcome') })

        expect(window.location.search).toBe('?screen=welcome')
        expect(pushSpy).toHaveBeenCalledTimes(1)
        expect(mockedCapture).toHaveBeenLastCalledWith(
            ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED,
            expect.objectContaining({ screen_id: 'welcome', nav_type: 'forward' })
        )
    })

    it('does not double-fire for a re-render of the same step', () => {
        const { rerender } = render({ enabled: true, step: stepById('landing') })
        rerender({ enabled: true, step: stepById('landing') })
        expect(mockedCapture).toHaveBeenCalledTimes(1)
    })

    it('walks back on popstate when the current step allows back', () => {
        const { rerender, goToScreen } = render({ enabled: true, step: stepById('landing') })
        rerender({ enabled: true, step: stepById('welcome') })

        popTo('landing')

        expect(goToScreen).toHaveBeenCalledWith('landing')
    })

    it('captures nav_type back without pushing a duplicate entry after a pop navigation', () => {
        const { rerender } = render({ enabled: true, step: stepById('landing') })
        rerender({ enabled: true, step: stepById('welcome') })
        popTo('landing')
        const pushSpy = jest.spyOn(window.history, 'pushState')
        pushSpy.mockClear()

        rerender({ enabled: true, step: stepById('landing') })

        expect(mockedCapture).toHaveBeenLastCalledWith(
            ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED,
            expect.objectContaining({ screen_id: 'landing', nav_type: 'back' })
        )
        expect(pushSpy).not.toHaveBeenCalled()
    })

    it('refuses to leave a point-of-no-return step and restores its entry', () => {
        const { rerender, goToScreen } = render({ enabled: true, step: stepById('signup') })
        rerender({ enabled: true, step: stepById('sign-test-transaction') })

        popTo('signup')

        expect(goToScreen).not.toHaveBeenCalled()
        expect(window.location.search).toBe('?screen=sign-test-transaction')
    })

    it('ignores popstate entries that are not mirrored setup steps', () => {
        const { goToScreen } = render({ enabled: true, step: stepById('landing') })

        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
        })

        expect(goToScreen).not.toHaveBeenCalled()
    })
})
