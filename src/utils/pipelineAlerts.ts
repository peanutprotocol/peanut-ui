/**
 * Single entry point for cross-cutting Sentry signals from the FE rendering
 * pipeline. Mirrors peanut-api-ts/src/utils/pipelineAlerts.ts — same category
 * union and tag schema so dashboards filter consistently across BE/FE. Sentry
 * import is lazy to keep the helper a no-op in test runner / SSR bundles.
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
