import type { FeatureReport, FeatureReportEntry, NextAction } from '@/types/capabilities'

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
 * The steps the API's feature report names, each once, with the feature it
 * names them for: an entry waiting on the user (`action_required`), or a
 * working one carrying a future-dated request. The report decides what is a
 * task; this only lists it (B5).
 */
export function reportTasks(
    report: FeatureReport | undefined,
    nextActions: readonly NextAction[]
): { action: NextAction; feature: keyof FeatureReport; entry: FeatureReportEntry }[] {
    if (!report) return []
    const byKey = new Map(nextActions.map((action) => [action.key, action]))
    const entries: [keyof FeatureReport, FeatureReportEntry][] = [
        ['bank', report.bank],
        ...Object.values(report.bank.accounts).map((entry): [keyof FeatureReport, FeatureReportEntry] => [
            'bank',
            entry,
        ]),
        ['local', report.local],
        ...Object.values(report.local.accounts).map((entry): [keyof FeatureReport, FeatureReportEntry] => [
            'local',
            entry,
        ]),
        ['card', report.card],
        ['qr', report.qr],
    ]
    const seen = new Set<string>()
    const tasks: { action: NextAction; feature: keyof FeatureReport; entry: FeatureReportEntry }[] = []
    for (const [feature, entry] of entries) {
        const action = entry.action ? byKey.get(entry.action) : undefined
        // Per feature: Bridge and Rain name the same `sumsub:proof_of_address` key for different asks.
        const once = `${feature}:${action?.key}`
        if (!action || seen.has(once)) continue
        if (entry.state !== 'action_required' && !(entry.state === 'on' && action.effectiveDate)) continue
        seen.add(once)
        tasks.push({ action, feature, entry })
    }
    return tasks
}

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
    report: FeatureReport | undefined,
    now: Date = new Date(),
    prioritizeIdentityRestart = false
): { largeTasks: NextAction[]; documentSlide: NextAction | undefined } {
    const tasks = selectBridgeTasks(nextActions, report, now)
    const cardTask = selectCardDocumentTask(nextActions, report)
    const bridgeTasks = selectBridgeDocumentTasks(nextActions, report)
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

/** The bank features' document requests the report names as the user's step: Bridge's, and Manteca's PEP or UIF ask. */
export function selectBridgeDocumentTasks(nextActions: NextAction[], report: FeatureReport | undefined): NextAction[] {
    return reportTasks(report, nextActions)
        .filter(
            ({ action, feature, entry }) =>
                (feature === 'bank' || feature === 'local') &&
                entry.state === 'action_required' &&
                action.kind === 'sumsub' &&
                !action.effectiveDate
        )
        .map(({ action }) => ({ ...action, key: `${BRIDGE_DOCUMENT_TASK_PREFIX}${action.key}` }))
}

/** The report entry that names a bank document task, for the reason the task explains. */
export function bridgeDocumentTaskEntry(
    task: NextAction,
    nextActions: NextAction[],
    report: FeatureReport | undefined
): FeatureReportEntry | undefined {
    const key = bridgeDocumentActionKey(task)
    return reportTasks(report, nextActions).find(({ action }) => action.key === key)?.entry
}

const CARD_DOCUMENT_TASK_PREFIX = 'card-document:'

/**
 * The card application's document request as a Home task: Rain asks for a
 * proof of address, or for the identity document again in its own portal
 * (`rain-hosted`). The card screen holds the button, so the task opens it.
 * Keyed apart from the action, because Bridge emits the same
 * `sumsub:proof_of_address` key and only the feature says whose ask it is.
 */
export function selectCardDocumentTask(
    nextActions: NextAction[],
    report: FeatureReport | undefined
): NextAction | undefined {
    const card = reportTasks(report, nextActions).find(
        ({ action, feature, entry }) =>
            feature === 'card' &&
            entry.state === 'action_required' &&
            (action.kind === 'rain-hosted' ||
                (action.kind === 'sumsub' &&
                    (action.levelKey === 'proof_of_address' || action.levelKey === 'rain_identity_verification')))
    )
    return card ? { ...card.action, key: `${CARD_DOCUMENT_TASK_PREFIX}${card.action.key}` } : undefined
}

export const isCardDocumentTask = (task: NextAction): boolean => task.key.startsWith(CARD_DOCUMENT_TASK_PREFIX)

/**
 * The bank tasks the report names: Bridge's terms (`accept-tos`), its hosted
 * check (`bridge-hosted`), and a future-dated document request inside the
 * heads-up window. A blocking hosted check stands down while a bank feature's
 * step is a Sumsub document the app collects itself: the hosted flow cannot
 * collect that document, so offering both put users in a loop (TASK-22818).
 * Advisory hosted tasks are about keeping access on a working rail and stay.
 */
export function selectBridgeTasks(
    nextActions: NextAction[],
    report: FeatureReport | undefined,
    now: Date = new Date()
): NextAction[] {
    const tasks = reportTasks(report, nextActions)
        .filter(({ feature }) => feature === 'bank' || feature === 'local')
        .map(({ action }) => action)
        .filter(
            (action) =>
                action.kind === 'accept-tos' ||
                action.kind === 'bridge-hosted' ||
                (action.kind === 'sumsub' && !!headsUpDeadline(action.effectiveDate, now))
        )
    if (!hasNativeBridgeStep(nextActions, report)) return tasks
    return tasks.filter((action) => action.kind !== 'bridge-hosted' || !!action.effectiveDate)
}

/** The bank feature's step is a Sumsub document the app runs itself. */
export function hasNativeBridgeStep(nextActions: NextAction[], report: FeatureReport | undefined): boolean {
    return reportTasks(report, nextActions).some(
        ({ action, feature, entry }) =>
            feature === 'bank' && entry.state === 'action_required' && action.kind === 'sumsub' && !action.effectiveDate
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
