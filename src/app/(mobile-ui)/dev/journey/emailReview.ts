/**
 * The copy-review layer over the live email spec.
 *
 * Turns the spec into a flat, board-ordered list of *renders* — one entry per
 * (email, `?example=N`) pair — which is what a product review actually walks:
 * 11 lifecycle emails, but 13 renders, because both first_spend steps render a
 * second example for the rewards branch.
 *
 * Nothing here restates a journeyData fact; the ordering is derived from
 * FUNNEL_STATES so the review list and the board can never disagree.
 */

import { FUNNEL_STATES, JOURNEY_API_BASE } from './journeyData'
import type { EmailDecisionFlag, EmailExample, EmailRenderRef, JourneySpec, SpecEmailStep } from './journeyTypes'

/** Tailwind treatment for anything still awaiting a product verdict. */
export const REVIEW_PENDING_CLASS = 'review-pending border-2 border-dashed border-yellow-1'

export function renderId(eventType: string, example: number): string {
    return `${eventType}#${example}`
}

export function emailPreviewUrl(eventType: string, example: number, raw: boolean): string {
    return `${JOURNEY_API_BASE}/__dev/email-preview/${eventType}?example=${example}${raw ? '&raw=1' : ''}`
}

/**
 * Which `?example=N` renders exist for a step. The spec only tells us a rewards
 * branch exists (`paragraphsWithRewards`), not what to call it — the labels are
 * ours, and deliberately name the branch rather than the index.
 */
export function examplesForStep(step: SpecEmailStep): EmailExample[] {
    if (step.paragraphsWithRewards?.length) {
        return [
            { index: 0, label: 'plain' },
            { index: 1, label: 'rewards' },
        ]
    }
    return [{ index: 0, label: 'default' }]
}

/**
 * Every email render, in the order the board lays them out (welcome first, then
 * each funnel column's stages left to right). Steps from stages the board hasn't
 * mapped to a column yet are appended rather than dropped — an unreviewed email
 * must never be invisible just because the column mapping lags the API.
 */
export function buildEmailRenderList(spec: JourneySpec | null): EmailRenderRef[] {
    if (!spec) return []

    const steps: SpecEmailStep[] = []
    const seen = new Set<string>()
    const add = (step: SpecEmailStep) => {
        if (seen.has(step.type)) return
        seen.add(step.type)
        steps.push(step)
    }

    for (const state of FUNNEL_STATES) {
        if (state.includesWelcome) add(spec.welcome)
        for (const stageName of state.specStages) {
            spec.stages.find((stage) => stage.stage === stageName)?.steps.forEach(add)
        }
    }
    for (const stage of spec.stages) stage.steps.forEach(add)

    return steps.flatMap((step) =>
        examplesForStep(step).map((example) => ({
            id: renderId(step.type, example.index),
            eventType: step.type,
            example: example.index,
            exampleLabel: example.label,
            step,
        }))
    )
}

/**
 * The two calls this review exists to settle. Everything else on the board is a
 * yes/no on the copy; these two are structural product decisions.
 */
export const EMAIL_DECISION_FLAGS: Record<string, EmailDecisionFlag> = {
    'lifecycle.first_spend_1': {
        label: 'decide: rewards branch keep/kill',
        note: 'Renders a second copy variant when the user has unclaimed rewards. Keep the branch or cut it to one message?',
    },
    'lifecycle.first_spend_2': {
        label: 'decide: rewards branch keep/kill',
        note: 'Renders a second copy variant when the user has unclaimed rewards. Keep the branch or cut it to one message?',
    },
    'lifecycle.finish_setup_1': {
        label: 'decide: kill or keep (0 prod audience)',
        note: 'The finish_setup stage matches no users in prod today. Keep the pair for future card states, or drop the stage?',
    },
    'lifecycle.finish_setup_2': {
        label: 'decide: kill or keep (0 prod audience)',
        note: 'The finish_setup stage matches no users in prod today. Keep the pair for future card states, or drop the stage?',
    },
}

export function decisionFlagFor(eventType: string): EmailDecisionFlag | null {
    return EMAIL_DECISION_FLAGS[eventType] ?? null
}
