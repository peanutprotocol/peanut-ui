import { useCallback, useMemo, useState } from 'react'
import { createParser, useQueryStates } from 'nuqs'
import posthog from 'posthog-js'
import type { DateRange } from 'react-day-picker'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    CUSTOM_PERIOD,
    LOCAL_DATE_RE,
    endOfLocalDay,
    matchPeriodPreset,
    periodAnalytics,
    presetDates,
    startOfLocalDay,
    toLocalDateString,
    type StatementPeriodOption,
} from './statementPeriod.utils'

// a local day that exists: `2026-02-31` has the shape but rolls over to March,
// so it must not become a period
const parseAsLocalDate = createParser({
    parse: (value) => (LOCAL_DATE_RE.test(value) && toLocalDateString(startOfLocalDay(value)) === value ? value : null),
    serialize: (value: string) => value,
})

/**
 * The statement period, held in the URL (`?from=2026-08-01&to=2026-08-31`,
 * local calendar days; neither = all time) per the URL-as-state rule, so a
 * period survives refresh and deep-links. `fromIso`/`toIso` are the API bounds
 * built from local midnight / end of day.
 *
 * Two picks the URL cannot hold stay local: "Custom period" chosen before any
 * day is tapped, and a calendar pick that has only its first day. A first tap
 * alone is already a one-day period in the URL, so Download never sends a
 * period the screen does not show.
 */
export function useStatementPeriod() {
    const [url, setUrlState] = useQueryStates(
        { from: parseAsLocalDate, to: parseAsLocalDate },
        { history: 'replace', shallow: true }
    )
    // a period needs both days in order; one of them, or a reversed pair, reads as all time
    const [from, to] = url.from && url.to && url.from <= url.to ? [url.from, url.to] : [null, null]
    const [customChosen, setCustomChosen] = useState(false)
    // null: the calendar shows the URL period. `days: undefined` is a cleared
    // calendar: nothing to download until the next pick, and no period in the URL.
    const [draft, setDraft] = useState<{ days: DateRange | undefined } | null>(null)

    const preset = useMemo(() => matchPeriodPreset(from, to), [from, to])
    const option: StatementPeriodOption = preset && !customChosen ? preset : CUSTOM_PERIOD
    const isCustom = option === CUSTOM_PERIOD
    const urlDays = useMemo(
        () => (from && to ? { from: startOfLocalDay(from), to: startOfLocalDay(to) } : undefined),
        [from, to]
    )
    const days = draft ? draft.days : urlDays

    const selectOption = useCallback(
        (next: StatementPeriodOption) => {
            setDraft(null)
            if (next === CUSTOM_PERIOD) {
                // the calendar opens on the current period; the URL changes on the first tap
                setCustomChosen(true)
                return
            }
            setCustomChosen(false)
            const dates = presetDates(next)
            void setUrlState(dates ?? { from: null, to: null })
            posthog.capture(
                ANALYTICS_EVENTS.ACTIVITY_RANGE_APPLIED,
                periodAnalytics({ preset: next, ...(dates ?? {}) })
            )
        },
        [setUrlState]
    )

    const selectDays = useCallback(
        (range: DateRange | undefined) => {
            // a calendar pick keeps the select on "Custom period", even when the
            // days happen to match a preset
            setCustomChosen(true)
            if (!range?.from) {
                // the URL loses the period too, so a refresh or a shared link
                // does not bring the cleared days back
                setDraft({ days: undefined })
                void setUrlState({ from: null, to: null })
                return
            }
            const fromDay = toLocalDateString(range.from)
            const toDay = toLocalDateString(range.to ?? range.from)
            void setUrlState({ from: fromDay, to: toDay })
            if (!range.to) {
                setDraft({ days: range })
                return
            }
            setDraft(null)
            posthog.capture(ANALYTICS_EVENTS.ACTIVITY_RANGE_APPLIED, periodAnalytics({ from: fromDay, to: toDay }))
        },
        [setUrlState]
    )

    return {
        from,
        to,
        fromIso: from ? startOfLocalDay(from).toISOString() : undefined,
        toIso: to ? endOfLocalDay(to).toISOString() : undefined,
        /** the preset the URL period matches — what analytics reports */
        preset,
        /** what the select shows */
        option,
        isCustom,
        /** the calendar selection */
        days,
        /** false while a custom period has no day picked: Download waits */
        isComplete: !isCustom || Boolean(days?.from),
        selectOption,
        selectDays,
    }
}
