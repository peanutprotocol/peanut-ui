import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { AskPolicy, AttentionAsk, Surface } from './types'

/** The `disabledAttentionAsks` item that turns every ask off. */
export const ALL_ASKS = '*'

// one report per rule or fact and app load: a throw that repeats on every decision files once
const reported = new Set<string>()

export function resetAttentionFaultsForTests(): void {
    reported.clear()
}

function report(key: string, error: unknown, tags: Record<string, string>): boolean {
    if (reported.has(key)) return false
    reported.add(key)
    Sentry.captureException(error, { tags: { feature: 'attention', ...tags } })
    return true
}

/** A fact derived from app data. A throw reads as `fallback`, so only the asks that read the fact change. */
export function fact<T>(name: string, read: () => T, fallback: T): T {
    try {
        return read()
    } catch (error) {
        report(`fact:${name}`, error, { fact: name })
        return fallback
    }
}

function rule<A extends unknown[], R>(ask: AttentionAsk, name: string, run: (...args: A) => R, fallback: R) {
    return (...args: A): R => {
        try {
            return run(...args)
        } catch (error) {
            if (report(`ask:${ask.id}:${name}`, error, { ask: ask.id, rule: name }))
                posthog.capture(ANALYTICS_EVENTS.ATTENTION_CRASHED, { ask: ask.id, rule: name, tier: ask.tier })
            return fallback
        }
    }
}

function guardPolicy(ask: AttentionAsk): AskPolicy {
    const { slotWhen, surfaceWhen } = ask.policy
    return {
        ...ask.policy,
        ...(slotWhen && { slotWhen: rule(ask, 'slotWhen', slotWhen, false) }),
        ...(surfaceWhen && {
            surfaceWhen: Object.fromEntries(
                Object.entries(surfaceWhen).map(([surface, when]) => [
                    surface,
                    rule(ask, `surfaceWhen.${surface}`, when, false),
                ])
            ) as Partial<Record<Surface, (typeof surfaceWhen)[Surface]>>,
        }),
    }
}

/** A throw in an ask's rules drops that ask from the decision; it never takes the other asks down. */
export function guardAsk(ask: AttentionAsk, disabled: boolean): AttentionAsk {
    const { renderable, deviceGate, version, legacyProps } = ask
    return {
        ...ask,
        eligible: disabled ? () => 'ineligible' : rule(ask, 'eligible', ask.eligible, 'ineligible'),
        ...(renderable && { renderable: rule(ask, 'renderable', renderable, false) }),
        ...(deviceGate && { deviceGate: rule(ask, 'deviceGate', deviceGate, 'ineligible' as const) }),
        ...(version && { version: rule(ask, 'version', version, undefined) }),
        ...(legacyProps && { legacyProps: rule(ask, 'legacyProps', legacyProps, {}) }),
        policy: guardPolicy(ask),
    }
}

/** Every ask behind its own guard; the ones the `disabledAttentionAsks` kill switch lists never show. */
export function guardAsks(asks: readonly AttentionAsk[], disabled: readonly string[]): readonly AttentionAsk[] {
    const all = disabled.includes(ALL_ASKS)
    return asks.map((ask) => guardAsk(ask, all || disabled.includes(ask.id)))
}
