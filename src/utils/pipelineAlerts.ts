/**
 * Single entry point for cross-cutting Sentry signals from the
 * FE-side rendering pipeline (transformer, receipt drawer, etc).
 * Mirrors peanut-api-ts/src/utils/pipelineAlerts.ts — same category
 * union and tag schema so dashboards filter consistently across BE/FE.
 *
 * Sentry import is lazy: importing `@sentry/nextjs` at module scope adds
 * weight to non-browser bundles (test runner, SSR). The dynamic import
 * keeps the helper a no-op when Sentry isn't initialised.
 */

export type PipelineAlertCategory =
    | 'reaper_vs_completion'
    | 'unknown_transformer_kind'
    | 'reaper_validator_anomaly'
    | 'orphaned_intent'
    | 'projection_drift'

export interface PipelineAlertExtra {
    intentId?: string
    kind?: string
    userId?: string
    source?: string
    [k: string]: unknown
}

export function pipelineAlert(
    category: PipelineAlertCategory,
    message: string,
    extra: PipelineAlertExtra = {},
    level: 'warning' | 'error' = 'error'
): void {
    if (typeof window === 'undefined') return
    import('@sentry/nextjs')
        .then((Sentry) =>
            Sentry.captureMessage(message, {
                level,
                tags: { component: 'pipeline', category, intentKind: (extra.kind as string | undefined) ?? 'n/a' },
                extra,
            })
        )
        .catch(() => {})
}
