import type { NextAction, RailCapability } from '@/types/capabilities'

/**
 * How many days before its due date a future-dated document request shows up:
 * the Home and Accounts task slide and the bank-screen notice both read this.
 * Earlier than that it stays silent. Bridge's expiring-ID requests are dated
 * years ahead, and a notice that far out is noise.
 */
export const ADVISORY_HEADS_UP_WINDOW_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The request's due date when it falls inside the heads-up window (a date
 * already past counts: it is still due), otherwise undefined.
 */
export function headsUpDeadline(effectiveDate: string | undefined, now: Date = new Date()): string | undefined {
    if (!effectiveDate) return undefined
    const due = new Date(effectiveDate).getTime()
    if (Number.isNaN(due)) return undefined
    return due - now.getTime() <= ADVISORY_HEADS_UP_WINDOW_DAYS * DAY_MS ? effectiveDate : undefined
}

/**
 * The nextActions renderable as pending Bridge verification tasks:
 * `accept-tos` (blocking, rail-attached — or advisory orphan) and
 * `bridge-hosted` (the hosted-flow catch-all), plus a future-dated `sumsub`
 * document request inside the heads-up window (only Bridge advisories carry
 * `effectiveDate`; a blocking sumsub step is gated on its own rail). One filter catches both the
 * blocking and the advisory (future-dated, `effectiveDate`-carrying)
 * populations — advisory actions arrive as orphans no rail references, so
 * reading top-level `nextActions` is the only way to see them.
 *
 * A BLOCKING hosted task stands down while a Bridge rail carries a native
 * `sumsub` step. Bridge lists its unmapped keys (`kyc_approval`, the
 * `kyc_with_proof_of_address` tier marker) beside the specific document it
 * wants, and the hosted flow (Persona identity) cannot collect that document,
 * so offering both put users in a loop (TASK-22818). The resolver no longer
 * emits the pair; this keeps older API responses honest too. Advisory hosted
 * tasks are about keeping access on a working rail and stay.
 */
export function selectBridgeTasks(
    nextActions: NextAction[],
    rails: RailCapability[] = [],
    now: Date = new Date()
): NextAction[] {
    const tasks = nextActions.filter(
        (action) =>
            action.kind === 'accept-tos' ||
            action.kind === 'bridge-hosted' ||
            (action.kind === 'sumsub' && !!headsUpDeadline(action.effectiveDate, now))
    )
    if (!hasNativeBridgeStep(nextActions, rails)) return tasks
    return tasks.filter((action) => action.kind !== 'bridge-hosted' || !!action.effectiveDate)
}

/** A requires-info Bridge rail whose blocking actions include a Sumsub step the app runs itself. */
export function hasNativeBridgeStep(nextActions: NextAction[], rails: RailCapability[]): boolean {
    const kindByKey = new Map(nextActions.map((action) => [action.key, action.kind]))
    return rails.some(
        (rail) =>
            rail.provider === 'bridge' &&
            rail.status === 'requires-info' &&
            (rail.blockingActions ?? []).some((key) => kindByKey.get(key) === 'sumsub')
    )
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
