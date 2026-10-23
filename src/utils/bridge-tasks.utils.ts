import type { NextAction, RailCapability } from '@/types/capabilities'
import { railVerdict } from '@/utils/capability-gate'

/**
 * How many days before its due date a future-dated document request shows up.
 * Earlier than that it stays silent: Bridge dates expiring-ID requests years
 * ahead, and a notice that far out is noise. Inside the window the bank-screen
 * notice and the Accounts task show it, and Home shows it as a carousel slide.
 */
export const ADVISORY_HEADS_UP_WINDOW_DAYS = 30

/**
 * The last days before the due date. Home then promotes the request from a
 * carousel slide to the large task card, and hides the carousel.
 */
export const ADVISORY_FINAL_WEEK_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/** Milliseconds until the due date; null for no date or an unreadable one. */
function msUntilDue(effectiveDate: string | undefined, now: Date): number | null {
    if (!effectiveDate) return null
    const due = new Date(effectiveDate).getTime()
    return Number.isNaN(due) ? null : due - now.getTime()
}

/**
 * The request's due date when it falls inside the heads-up window (a date
 * already past counts: it is still due), otherwise undefined.
 */
export function headsUpDeadline(effectiveDate: string | undefined, now: Date = new Date()): string | undefined {
    const ms = msUntilDue(effectiveDate, now)
    return ms !== null && ms <= ADVISORY_HEADS_UP_WINDOW_DAYS * DAY_MS ? effectiveDate : undefined
}

/** Due in the last week, or already past. */
export function isInFinalWeek(effectiveDate: string | undefined, now: Date = new Date()): boolean {
    const ms = msUntilDue(effectiveDate, now)
    return ms !== null && ms <= ADVISORY_FINAL_WEEK_DAYS * DAY_MS
}

/** A future-dated document request (Bridge advisory Sumsub step). */
const isDocumentRequest = (action: NextAction): boolean => action.kind === 'sumsub' && !!action.effectiveDate

/**
 * The Home split of the verification tasks. Home shows one CTA surface at a
 * time: the large task card or the carousel, never both.
 *
 * - `largeTasks`: the large card. A document request joins it only in its
 *   final week; the card application's document request always does.
 * - `documentSlide`: a document request inside the heads-up window but before
 *   its final week. It leads the carousel as a small item.
 */
export function selectHomeTasks(
    nextActions: NextAction[],
    rails: RailCapability[] = [],
    now: Date = new Date(),
    prioritizeIdentityRestart = false
): { largeTasks: NextAction[]; documentSlide: NextAction | undefined } {
    const tasks = selectBridgeTasks(nextActions, rails, now)
    const cardTask = selectCardDocumentTask(nextActions, rails)
    const bridgeTasks = selectBridgeDocumentTasks(nextActions, rails)
    const blockingKeys = new Set(bridgeTasks.map((task) => bridgeDocumentActionKey(task)))
    return {
        largeTasks: [
            ...tasks.filter(
                (task) =>
                    !blockingKeys.has(task.key) && (!isDocumentRequest(task) || isInFinalWeek(task.effectiveDate, now))
            ),
            ...(prioritizeIdentityRestart ? [] : bridgeTasks),
            ...(cardTask ? [cardTask] : []),
        ],
        documentSlide: tasks.find(
            (task) => !blockingKeys.has(task.key) && isDocumentRequest(task) && !isInFinalWeek(task.effectiveDate, now)
        ),
    }
}

const BRIDGE_DOCUMENT_TASK_PREFIX = 'bridge-document:'

export const isBridgeDocumentTask = (task: NextAction): boolean => task.key.startsWith(BRIDGE_DOCUMENT_TASK_PREFIX)
export const bridgeDocumentActionKey = (task: NextAction): string => task.key.slice(BRIDGE_DOCUMENT_TASK_PREFIX.length)

export function selectBridgeDocumentTasks(nextActions: NextAction[], rails: RailCapability[]): NextAction[] {
    const byKey = new Map(nextActions.map((action) => [action.key, action]))
    const tasks = new Map<string, NextAction>()
    for (const rail of rails) {
        if (rail.provider !== 'bridge' || rail.status !== 'requires-info') continue
        const { status, nextAction } = railVerdict(rail, byKey)
        if (status !== 'fixable' || nextAction?.kind !== 'sumsub') continue
        tasks.set(nextAction.key, {
            ...nextAction,
            key: `${BRIDGE_DOCUMENT_TASK_PREFIX}${nextAction.key}`,
            effectiveDate: undefined,
        })
    }
    return [...tasks.values()]
}

const CARD_DOCUMENT_TASK_PREFIX = 'card-document:'

/**
 * The card application's document request as a Home task: Rain asks for a
 * proof of address, or for the identity document again in its own portal
 * (`rain-hosted`). The card screen holds the button, so the task opens it.
 * Only a requires-info rail: a denial is a verdict, and a collected document
 * waiting for review is a `wait`. Keyed apart from the action, because Bridge
 * emits the same `sumsub:proof_of_address` key and only the rail says whose
 * ask it is.
 */
export function selectCardDocumentTask(nextActions: NextAction[], rails: RailCapability[]): NextAction | undefined {
    const byKey = new Map(nextActions.map((action) => [action.key, action]))
    for (const rail of rails) {
        if (rail.provider !== 'rain' || rail.status !== 'requires-info') continue
        const { status, nextAction } = railVerdict(rail, byKey)
        if (status !== 'fixable' || !nextAction) continue
        if (
            nextAction.kind === 'rain-hosted' ||
            (nextAction.kind === 'sumsub' &&
                (nextAction.levelKey === 'proof_of_address' || nextAction.levelKey === 'rain_identity_verification'))
        ) {
            return { ...nextAction, key: `${CARD_DOCUMENT_TASK_PREFIX}${nextAction.key}` }
        }
    }
    return undefined
}

export const isCardDocumentTask = (task: NextAction): boolean => task.key.startsWith(CARD_DOCUMENT_TASK_PREFIX)

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
