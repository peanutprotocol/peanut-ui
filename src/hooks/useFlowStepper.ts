'use client'

import { useCallback, useEffect } from 'react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import type { FlowStepper, FlowStepperOptions } from './useFlowStepper.types'

/**
 * URL-backed step cursor for multi-step flows (design.md "multi-step flow").
 *
 * The step lives in the URL as a named screen id (`?step=review`), so it
 * survives refresh and is shareable. nuqs keeps its default `replace` history:
 * in-flow back is `NavHeader onPrev={stepper.back}`, browser back exits the
 * whole flow — intended, per design.md.
 *
 * This is a cursor with guards, not a state machine: any step may move to any
 * other step; guards only protect entry into a step whose prerequisites are
 * missing (refresh mid-flow, hand-edited URL).
 */
export function useFlowStepper<Step extends string>(options: FlowStepperOptions<Step>): FlowStepper<Step> {
    const { steps, defaultStep = options.steps[0], urlKey = 'step', guards, backMap, onExit } = options

    const [rawStep, setStep] = useQueryState(urlKey, parseAsStringEnum([...steps]).withDefault(defaultStep))

    // A guarded step never renders — resolve to its fallback synchronously so
    // there is no one-frame flash of the dead screen.
    const guard = guards?.[rawStep]
    const step = guard && !guard.ok ? (guard.fallback ?? defaultStep) : rawStep

    // Keep the URL honest after a guard redirect (replace, no history entry).
    // Strict-mode safe: setting the same value again is a no-op for nuqs.
    useEffect(() => {
        if (step !== rawStep) void setStep(step === defaultStep ? null : step)
    }, [step, rawStep, defaultStep, setStep])

    const goTo = useCallback(
        // The default step is represented by a clean URL (no param). The
        // returned promise resolves once the (throttled) URL write lands.
        (next: Step) => setStep(next === defaultStep ? null : next),
        [setStep, defaultStep]
    )

    const index = steps.indexOf(step)
    const previous = backMap?.[step] ?? (index > 0 ? steps[index - 1] : undefined)

    const back = useCallback(() => {
        if (previous === undefined) {
            onExit?.()
            return Promise.resolve()
        }
        return setStep(previous === defaultStep ? null : previous).then(() => undefined)
    }, [previous, setStep, defaultStep, onExit])

    const reset = useCallback(() => setStep(null), [setStep])

    return { step, goTo, back, reset, isFirst: previous === undefined }
}
