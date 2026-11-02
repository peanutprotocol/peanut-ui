/**
 * The re-consent prompt's "Not now" date.
 *
 * ToS §17.2 gives material changes a 30-day notice period and offers the in-app
 * click-through as a way to accept sooner, by choice. §17.3 then says a user who
 * does not agree must be able to stop using the Services — which, for a
 * non-custodial wallet, has to include reaching their own funds. So the prompt
 * is a reminder, not a lock: "Not now" defers it to the date the documents
 * actually take effect. The snooze is an attention-ledger entry, never a
 * consent-ledger row: declining is not a consent event.
 */

/** ToS §17.2 — material changes take effect no earlier than 30 days after posting. */
export const LEGAL_NOTICE_PERIOD_DAYS = 30

/**
 * Floor for a document already past its notice period. Past that date §17.3
 * makes continued use acceptance on its own, so the prompt only still asks in
 * order to record explicit consent — worth a gentle cadence, not every app open.
 */
export const MIN_SNOOZE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * When the prompt may reappear after a "Not now": the latest effective date
 * across the documents shown, floored to MIN_SNOOZE_DAYS.
 *
 * `currentVersion` is the document's frontmatter `last_updated` (an ISO date),
 * so effective = version + 30 days. An unparseable version contributes nothing
 * rather than throwing — the floor still applies.
 */
export function nextPromptAt(versions: string[], now: number = Date.now()): number {
    const effectiveDates = versions
        .map((version) => Date.parse(version))
        .filter((parsed) => Number.isFinite(parsed))
        .map((parsed) => parsed + LEGAL_NOTICE_PERIOD_DAYS * DAY_MS)
    return Math.max(now + MIN_SNOOZE_DAYS * DAY_MS, ...effectiveDates)
}
