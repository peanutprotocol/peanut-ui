import type { ScreenId } from '@/components/Setup/Setup.types'

/**
 * The progress dots for a step: one dot per step, Landing included, so the first screen after Landing already shows
 * one done dot (v7 "progress head start"). Landing itself shows no dots. Null when the step is not in the list.
 */
export function setupProgress(
    steps: readonly { screenId: ScreenId }[],
    screenId: ScreenId
): { index: number; total: number } | null {
    const index = steps.findIndex((step) => step.screenId === screenId)
    if (index < 0 || screenId === 'landing') return null
    return { index, total: steps.length }
}
