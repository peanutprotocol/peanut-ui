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
 * Fingerprint a task for dismissal persistence. The task `key` alone is NOT
 * enough: keys stay identical when an advisory task turns blocking (its
 * `effectiveDate` passes and disappears) and when a NEW Bridge requirement
 * arrives under the shared `bridge-hosted` key (only `requirementKey`
 * changes). A dismissal must not survive either — the user dismissed a
 * "due later" reminder, not the failure of their live bank transfers — so
 * both fields join the fingerprint and any change re-surfaces the slide.
 */
export function bridgeTaskDismissalKey(task: NextAction): string {
    return [task.key, task.requirementKey ?? '', task.effectiveDate ?? 'due-now'].join('|')
}
