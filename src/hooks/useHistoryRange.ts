import { useCallback, useMemo } from 'react'
import { createParser, useQueryStates } from 'nuqs'
import {
    HISTORY_RANGE_PRESETS,
    LOCAL_DATE_RE,
    endOfLocalDay,
    presetDates,
    startOfLocalDay,
    type HistoryRangePreset,
} from '@/utils/historyRange.utils'

const parseAsLocalDate = createParser({
    parse: (value) => (LOCAL_DATE_RE.test(value) ? value : null),
    serialize: (value: string) => value,
})

/**
 * The history timeframe filter, held in the URL (`?from=2026-08-01&to=2026-08-31`)
 * per the URL-as-state rule — a filtered view survives refresh and deep-links.
 * Values are local calendar days; `fromIso`/`toIso` are the API bounds built
 * from local midnight / end of day.
 */
export function useHistoryRange() {
    const [{ from, to }, setUrlState] = useQueryStates(
        { from: parseAsLocalDate, to: parseAsLocalDate },
        { history: 'replace', shallow: true }
    )

    const fromDate = from ? startOfLocalDay(from) : undefined
    const toDate = to ? endOfLocalDay(to) : undefined

    // Which preset the current URL range corresponds to, if any — custom
    // calendar picks land on undefined.
    const activePreset: HistoryRangePreset | undefined = useMemo(() => {
        if (!from && !to) return 'allTime'
        return HISTORY_RANGE_PRESETS.find((preset) => {
            const dates = presetDates(preset)
            return dates !== null && dates.from === from && dates.to === to
        })
    }, [from, to])

    const setPreset = useCallback(
        (preset: HistoryRangePreset) => setUrlState(presetDates(preset) ?? { from: null, to: null }),
        [setUrlState]
    )

    const setCustom = useCallback(
        (fromValue: string, toValue: string) => setUrlState({ from: fromValue, to: toValue }),
        [setUrlState]
    )

    const isInRange = useCallback(
        (date: Date) => (!from || date >= startOfLocalDay(from)) && (!to || date <= endOfLocalDay(to)),
        [from, to]
    )

    return {
        from,
        to,
        fromDate,
        toDate,
        fromIso: fromDate?.toISOString(),
        toIso: toDate?.toISOString(),
        hasActiveRange: Boolean(from || to),
        activePreset,
        setPreset,
        setCustom,
        isInRange,
    }
}
