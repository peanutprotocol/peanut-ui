'use client'

import { type ISetupStep, type ScreenId } from '@/components/Setup/Setup.types'
import { setupSteps as masterSetupSteps } from '@/components/Setup/Setup.consts'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import type { FlowStepGuard } from '@/hooks/useFlowStepper.types'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useCallback, useEffect, useMemo, useRef } from 'react'

/** ?screen=, not ?step=: at /setup entry, ?step=signup is an existing contract
 * that skips the invite gate (see determineInitialStep). */
export const SETUP_SCREEN_PARAM = 'screen'

/**
 * The setup flow's cursor: a named screen id in the URL (?screen=signup),
 * driven by the shared stepper (TASK-21460). This replaced a redux numeric
 * index into the runtime-filtered step list whose next/previous clamps
 * silently dead-ended (TASK-21404).
 *
 * history: 'push' — a deliberate deviation from the design.md default: the
 * signup funnel wants the browser/hardware Back button to walk the steps
 * (mobile users reflexively use it), which is the contract the old
 * useSetupStepUrlSync pushState mirror established. Point of no return:
 * once a step with showBackButton=false renders (e.g. sign-test-transaction —
 * the passkey is already registered), every earlier step's guard refuses and
 * bounces back, so a history pop cannot re-enter the forms.
 */
export const useSetupFlow = () => {
    const { steps, isLoading, setIsLoading, direction, setDirection } = useSetupFlowContext()

    const screenIds = useMemo<ScreenId[]>(
        // before the layout populates the filtered list, accept every master
        // screen id — a narrower placeholder would make the stepper's guard
        // effect rewrite a valid ?screen= away before the steps arrive.
        // Nothing renders during that window (the page's entry determination
        // is still loading).
        () => (steps.length > 0 ? steps.map((s) => s.screenId) : masterSetupSteps.map((s) => s.screenId)),
        [steps]
    )

    // The rendered step from the previous render — guards derive the
    // point-of-no-return from it (every stepper instance renders the same URL
    // step, so per-instance refs stay consistent).
    const lastRenderedRef = useRef<{ screenId: ScreenId; index: number; noBack: boolean } | null>(null)

    const guards = useMemo(() => {
        const last = lastRenderedRef.current
        if (!last || !last.noBack) return undefined
        const result: Partial<Record<ScreenId, FlowStepGuard<ScreenId>>> = {}
        for (let i = 0; i < screenIds.length; i++) {
            if (i < last.index) result[screenIds[i]] = { ok: false, fallback: last.screenId }
        }
        return result
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screenIds, lastRenderedRef.current])

    const stepper = useFlowStepper<ScreenId>({
        steps: screenIds,
        urlKey: SETUP_SCREEN_PARAM,
        history: 'push',
        guards,
    })

    const currentIndex = screenIds.indexOf(stepper.step)
    const step: ISetupStep | undefined = steps[currentIndex]

    useEffect(() => {
        if (!step) return
        lastRenderedRef.current = {
            screenId: step.screenId,
            index: currentIndex,
            noBack: step.showBackButton === false,
        }
    }, [step, currentIndex])

    const setScreenId = useCallback(
        (screenId: ScreenId, options?: { history?: 'replace' | 'push' }) => {
            if (!screenIds.includes(screenId)) return
            const targetIndex = screenIds.indexOf(screenId)
            setDirection(targetIndex >= currentIndex ? 1 : -1)
            void stepper.goTo(screenId, options)
        },
        [screenIds, currentIndex, setDirection, stepper]
    )

    const handleNext = useCallback(
        async (callback?: () => Promise<boolean>, screenId?: ScreenId) => {
            setIsLoading(true)
            try {
                if (callback) {
                    const isValid = await callback()
                    if (!isValid) return
                }
                if (screenId && screenIds.includes(screenId)) {
                    setScreenId(screenId)
                    return
                }
                // explicit end-of-list — no silent clamp (TASK-21404)
                const next = screenIds[currentIndex + 1]
                if (next) {
                    setDirection(1)
                    void stepper.goTo(next)
                }
            } finally {
                setIsLoading(false)
            }
        },
        [screenIds, currentIndex, setScreenId, setDirection, setIsLoading, stepper]
    )

    const handleBack = useCallback(() => {
        const previous = screenIds[currentIndex - 1]
        if (!previous) return
        setDirection(-1)
        void stepper.goTo(previous)
    }, [screenIds, currentIndex, setDirection, stepper])

    return {
        step,
        currentIndex,
        direction,
        isFirstStep: currentIndex === 0,
        isLastStep: currentIndex === screenIds.length - 1,
        isLoading,
        handleNext,
        handleBack,
        setScreenId,
    }
}
