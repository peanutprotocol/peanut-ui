import type { NextAction } from '@/types/capabilities'

/**
 * The nextActions renderable as pending Bridge verification tasks:
 * `accept-tos` (blocking, rail-attached — or advisory orphan) and
 * `bridge-hosted` (the hosted-flow catch-all). One filter catches both the
 * blocking and the advisory (future-dated, `effectiveDate`-carrying)
 * populations — advisory actions arrive as orphans no rail references, so
 * reading top-level `nextActions` is the only way to see them.
 */
export function selectBridgeTasks(nextActions: NextAction[]): NextAction[] {
    return nextActions.filter((action) => action.kind === 'accept-tos' || action.kind === 'bridge-hosted')
}

/**
 * Fingerprint a task for dismissal persistence. Only ADVISORY (future-dated)
 * tasks are dismissible — a blocking task's fingerprint is constant over time
 * (`accept-tos||due-now`), so honoring a stored one would hide a NEW
 * same-variant requirement months later while the user's rails are gated; the
 * card exempts blocking tasks from dismissal filtering entirely. For
 * advisories the task `key` alone is NOT enough: keys stay identical when a
 * NEW requirement arrives under the shared `bridge-hosted` key (only
 * `requirementKey` changes) or when a new round of the same requirement gets
 * a new deadline — so both fields join the fingerprint and any change
 * re-surfaces the slide. The advisory→blocking escalation is covered twice:
 * the date leaving changes the fingerprint AND the now-blocking task stops
 * consulting dismissals at all.
 */
export function bridgeTaskDismissalKey(task: NextAction): string {
    return [task.key, task.requirementKey ?? '', task.effectiveDate ?? 'due-now'].join('|')
}
