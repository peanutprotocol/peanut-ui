'use client'

import { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, type AnalyticsEvent } from '@/constants/analytics.consts'
import type {
    PaperworkVerificationFeature,
    PaperworkVerificationStep,
} from '@/app/actions/types/kyc-paperwork-verification.types'

/**
 * What the Smart Paperwork Verification screens report, and what they deliberately do not.
 *
 * The answers are identity data (an address, a tax number, a declaration), and
 * PostHog is built for aggregate questions. So an event names the step, the
 * field key and the error code, and never carries what was typed or picked:
 * the funnel can say "the CPF field is refused 30% of the time on Brazil's tax
 * step", never whose CPF. Search events send the query length, not the query.
 * `control_used` follows the same rule: a field reports that it was edited,
 * picked or toggled, never the answer. Its only values are what other events
 * already send (the residence, the document type) and UI modes.
 */
export interface PaperworkVerificationTrackingContext {
    flow: 'paperwork_verification' | 'add_later'
    residence: string | null
    features?: Partial<Record<PaperworkVerificationFeature, boolean>>
    /** add-later: the feature being added */
    feature?: PaperworkVerificationFeature
    /** the lead step of the screen in view */
    step?: string
    /** a verified user's new identity check */
    restart?: boolean
}

const Context = createContext<PaperworkVerificationTrackingContext | null>(null)
export const PaperworkVerificationTrackingProvider = Context.Provider
export const usePaperworkVerificationTrackingContext = () => useContext(Context)

export type KycControlAction = 'tap' | 'open' | 'dismiss' | 'select' | 'change' | 'error' | 'toggle'
/** The `flow` of a KYC surface outside the verification flow's tracking provider. */
export type KycControlFlow = 'kyc_status' | 'kyc_legacy' | 'kyc_provider_request'

const ControlScreenContext = createContext<string | null>(null)
/** The screen a control sits on, so a picker or drawer deep inside a screen needs no prop. */
export const KycControlScreenProvider = ControlScreenContext.Provider
const ControlFlowContext = createContext<KycControlFlow | null>(null)
/** The flow of a surface outside the verification flow, for the shared controls it renders. */
export const KycControlFlowProvider = ControlFlowContext.Provider

/**
 * One use of a KYC control (CONTROL_USED), sent beside the screen's own events.
 * Inside the verification flow it carries that flow's context, elsewhere the
 * surface's fixed flow; with neither, or no screen, it sends nothing.
 * `value` is an option code, never what the user typed.
 */
export function trackKycControl(
    where: { ctx: PaperworkVerificationTrackingContext | null; flow?: KycControlFlow | null; screenId?: string | null },
    control: string,
    action: KycControlAction,
    value?: string
): void {
    const { ctx, flow, screenId } = where
    if (!screenId || (!ctx && !flow)) return
    try {
        posthog.capture(ANALYTICS_EVENTS.CONTROL_USED, {
            ...(ctx ? baseProperties(ctx) : { flow }),
            screen_id: screenId,
            control,
            action,
            ...(value !== undefined && { value }),
        })
    } catch {
        // Analytics never breaks a verification step.
    }
}

/** `trackKycControl` for the screen in view; `fallbackFlow` applies outside the flow and any surface's own flow. */
export function useKycControl(screenId?: string, fallbackFlow?: KycControlFlow) {
    const ctx = useContext(Context)
    const scopedScreen = useContext(ControlScreenContext)
    const scopedFlow = useContext(ControlFlowContext)
    const sentOnce = useRef(new Set<string>())
    const screen = screenId ?? scopedScreen
    const flow = scopedFlow ?? fallbackFlow

    return useMemo(() => {
        const track = (control: string, action: KycControlAction, value?: string) =>
            trackKycControl({ ctx, flow, screenId: screen }, control, action, value)
        return {
            track,
            /** Once per mount, so a field reports that it was edited, not every keystroke. */
            trackOnce: (control: string, action: KycControlAction) => {
                const key = `${control}:${action}`
                if (sentOnce.current.has(key)) return
                sentOnce.current.add(key)
                track(control, action)
            },
        }
    }, [ctx, screen, flow])
}

const baseProperties = (ctx: PaperworkVerificationTrackingContext | null) =>
    ctx
        ? {
              flow: ctx.flow,
              residence: ctx.residence,
              ...(ctx.feature && { feature: ctx.feature }),
              ...(ctx.step && { step: ctx.step }),
              ...(ctx.restart && { restart: true }),
              ...(ctx.features &&
                  Object.fromEntries(Object.entries(ctx.features).map(([k, on]) => [`feature_${k}`, !!on]))),
          }
        : {}

export function trackPaperworkVerification(
    ctx: PaperworkVerificationTrackingContext | null,
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
export function usePaperworkVerificationTrack() {
    const ctx = useContext(Context)
    return useCallback(
        (event: AnalyticsEvent, properties?: Record<string, unknown>) =>
            trackPaperworkVerification(ctx, event, properties),
        [ctx]
    )
}

/** A screen's step ids, e.g. `address+phone` when the phone shares the address screen. */
export const stepsLabel = (steps: Pick<PaperworkVerificationStep, 'id'>[]) => steps.map((s) => s.id).join('+')

/** How long the screen has been in view, in whole seconds. */
export const secondsSince = (startedAt: number) => Math.round((Date.now() - startedAt) / 1000)
