'use client'

import { createContext, useCallback, useContext } from 'react'
import posthog from 'posthog-js'
import type { AnalyticsEvent } from '@/constants/analytics.consts'
import type { VerifyOnceFeature, VerifyOnceStep } from '@/app/actions/types/kyc-verify-once.types'

/**
 * What the verify-once screens report, and what they deliberately do not.
 *
 * The answers are identity data (an address, a tax number, a declaration), and
 * PostHog is built for aggregate questions. So an event names the step, the
 * field key and the error code, and never carries what was typed or picked:
 * the funnel can say "the CPF field is refused 30% of the time on Brazil's tax
 * step", never whose CPF. Search events send the query length, not the query.
 */
export interface VerifyOnceTrackingContext {
    flow: 'verify_once' | 'add_later'
    residence: string | null
    features?: Partial<Record<VerifyOnceFeature, boolean>>
    /** add-later: the feature being added */
    feature?: VerifyOnceFeature
    /** the lead step of the screen in view */
    step?: string
}

const Context = createContext<VerifyOnceTrackingContext | null>(null)
export const VerifyOnceTrackingProvider = Context.Provider
export const useVerifyOnceTrackingContext = () => useContext(Context)

const baseProperties = (ctx: VerifyOnceTrackingContext | null) =>
    ctx
        ? {
              flow: ctx.flow,
              residence: ctx.residence,
              ...(ctx.feature && { feature: ctx.feature }),
              ...(ctx.step && { step: ctx.step }),
              ...(ctx.features &&
                  Object.fromEntries(Object.entries(ctx.features).map(([k, on]) => [`feature_${k}`, !!on]))),
          }
        : {}

export function trackVerifyOnce(
    ctx: VerifyOnceTrackingContext | null,
    event: AnalyticsEvent,
    properties: Record<string, unknown> = {}
): void {
    try {
        posthog.capture(event, { ...baseProperties(ctx), ...properties })
    } catch {
        // Analytics never breaks a verification step.
    }
}

/** `track(event, props)` with the flow, residence, features and step of the screen in view. */
export function useVerifyOnceTrack() {
    const ctx = useContext(Context)
    return useCallback(
        (event: AnalyticsEvent, properties?: Record<string, unknown>) => trackVerifyOnce(ctx, event, properties),
        [ctx]
    )
}

/** A screen's step ids, e.g. `address+phone` when the phone shares the address screen. */
export const stepsLabel = (steps: Pick<VerifyOnceStep, 'id'>[]) => steps.map((s) => s.id).join('+')

/** How long the screen has been in view, in whole seconds. */
export const secondsSince = (startedAt: number) => Math.round((Date.now() - startedAt) / 1000)
