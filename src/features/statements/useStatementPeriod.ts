import { useCallback, useMemo, useState } from 'react'
import { createParser, useQueryStates } from 'nuqs'
import posthog from 'posthog-js'
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
    type PickedDays,
    type StatementPeriodOption,
} from './statementPeriod.utils'

const parseAsLocalDate = createParser({
    parse: (value) => (LOCAL_DATE_RE.test(value) ? value : null),
    serialize: (value: string) => value,
})

/**
 * The statement period, held in the URL (`?from=2026-08-01&to=2026-08-31`,
 * local calendar days; neither = all time) per the URL-as-state rule, so a
 * period survives refresh and deep-links. `fromIso`/`toIso` are the API bounds
 * built from local midnight / end of day. A period needs both days, so a URL
 * with only one of them reads as all time.
 *
 * "Custom period" opens the custom period drawer and changes nothing until
 * Apply. Closing the drawer any other way keeps the period chosen before, so
 * the select never shows a custom period without its days.
 */
export function useStatementPeriod() {
    const [url, setUrlState] = useQueryStates(
        { from: parseAsLocalDate, to: parseAsLocalDate },
        { history: 'replace', shallow: true }
    )
    const [from, to] = url.from && url.to ? [url.from, url.to] : [null, null]
    // Apply keeps the select on "Custom period", even when the days match a preset
    const [customApplied, setCustomApplied] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const preset = useMemo(() => matchPeriodPreset(from, to), [from, to])
    const option: StatementPeriodOption = preset && !customApplied ? preset : CUSTOM_PERIOD
    const days = useMemo(
        () => (from && to ? { from: startOfLocalDay(from), to: startOfLocalDay(to) } : undefined),
        [from, to]
    )

    const selectOption = useCallback(
        (next: StatementPeriodOption) => {
            if (next === CUSTOM_PERIOD) {
                setDrawerOpen(true)
                return
            }
            setCustomApplied(false)
            const dates = presetDates(next)
            void setUrlState(dates ?? { from: null, to: null })
            posthog.capture(
                ANALYTICS_EVENTS.ACTIVITY_RANGE_APPLIED,
                periodAnalytics({ preset: next, ...(dates ?? {}) })
            )
        },
        [setUrlState]
    )

    /** The drawer's Apply. A first day alone is a one-day period. */
    const applyDays = useCallback(
        (range: PickedDays) => {
            const fromDay = toLocalDateString(range.from)
            const toDay = toLocalDateString(range.to ?? range.from)
            setCustomApplied(true)
            setDrawerOpen(false)
            void setUrlState({ from: fromDay, to: toDay })
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
        isCustom: option === CUSTOM_PERIOD,
        /** the period's first and last day; all time has none */
        days,
        /** the custom period drawer */
        drawerOpen,
        /** "Change dates": the select cannot reopen the drawer while it already shows "Custom period" */
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        selectOption,
        applyDays,
    }
}
