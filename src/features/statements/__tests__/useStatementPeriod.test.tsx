import { act, renderHook, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { useStatementPeriod } from '../useStatementPeriod'
import { presetDates, startOfLocalDay } from '../statementPeriod.utils'

// The real nuqs pipeline runs through the official testing adapter, so these
// assert the URL contract itself: `?from=yyyy-MM-dd&to=yyyy-MM-dd`, local days.

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))

function renderPeriod(search = '') {
    const updates: UrlUpdateEvent[] = []
    const view = renderHook(() => useStatementPeriod(), {
        wrapper: withNuqsTestingAdapter({ searchParams: search, hasMemory: true, onUrlUpdate: (e) => updates.push(e) }),
    })
    return { ...view, updates, url: () => updates.at(-1)?.searchParams }
}

// URL writes flush after the handler returns; wait past that before asserting none happened
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))

const AUG_3 = new Date(2026, 7, 3)
const AUG_14 = new Date(2026, 7, 14)

beforeEach(() => mockCapture.mockClear())

describe('useStatementPeriod', () => {
    it('reads no period as all time, with no API bounds', () => {
        const { result } = renderPeriod()
        expect(result.current.option).toBe('allTime')
        expect(result.current.isCustom).toBe(false)
        expect(result.current.fromIso).toBeUndefined()
        expect(result.current.toIso).toBeUndefined()
        expect(result.current.days).toBeUndefined()
        expect(result.current.isComplete).toBe(true)
    })

    it('opens a deep-linked period as a custom one, with local-day API bounds', () => {
        const { result } = renderPeriod('?from=2026-08-03&to=2026-08-14')
        expect(result.current.option).toBe('custom')
        expect(result.current.days).toEqual({ from: AUG_3, to: AUG_14 })
        expect(result.current.fromIso).toBe(AUG_3.toISOString())
        expect(result.current.toIso).toBe(new Date(2026, 7, 14, 23, 59, 59, 999).toISOString())
    })

    it('shows a deep-linked preset period as that preset', () => {
        const dates = presetDates('last30d')!
        const { result } = renderPeriod(`?from=${dates.from}&to=${dates.to}`)
        expect(result.current.option).toBe('last30d')
        expect(result.current.preset).toBe('last30d')
    })

    it('ignores URL values that are not local days', () => {
        const { result } = renderPeriod('?from=yesterday&to=2026-8-1')
        expect(result.current.from).toBeNull()
        expect(result.current.to).toBeNull()
        expect(result.current.option).toBe('allTime')
    })

    it('writes a preset to the URL and reports its name and length, never its dates', async () => {
        const { result, url } = renderPeriod()
        act(() => result.current.selectOption('last7d'))

        const dates = presetDates('last7d')!
        await waitFor(() => expect(url()?.get('from')).toBe(dates.from))
        expect(url()?.get('to')).toBe(dates.to)
        expect(result.current.option).toBe('last7d')
        expect(mockCapture).toHaveBeenCalledWith('activity_range_applied', { range_preset: 'last7d', range_days: 7 })
    })

    it('clears the period from the URL for all time', async () => {
        const { result, url } = renderPeriod('?from=2026-08-03&to=2026-08-14')
        act(() => result.current.selectOption('allTime'))

        await waitFor(() => expect(url()?.has('from')).toBe(false))
        expect(url()?.has('to')).toBe(false)
        expect(result.current.option).toBe('allTime')
    })

    it('keeps the URL when custom is chosen, and opens the calendar on the current period', async () => {
        const dates = presetDates('last30d')!
        const { result, updates } = renderPeriod(`?from=${dates.from}&to=${dates.to}`)
        act(() => result.current.selectOption('custom'))

        await settle()
        expect(updates).toHaveLength(0)
        expect(result.current.option).toBe('custom')
        expect(result.current.days?.from).toEqual(startOfLocalDay(dates.from))
        expect(result.current.isComplete).toBe(true)
    })

    it('waits for a day when custom is chosen from all time', () => {
        const { result } = renderPeriod()
        act(() => result.current.selectOption('custom'))

        expect(result.current.isCustom).toBe(true)
        expect(result.current.days).toBeUndefined()
        expect(result.current.isComplete).toBe(false)
    })

    it('treats a first tap as a one-day period, and the second tap finishes the period', async () => {
        const { result, url } = renderPeriod()
        act(() => result.current.selectOption('custom'))

        act(() => result.current.selectDays({ from: AUG_3, to: undefined }))
        await waitFor(() => expect(url()?.get('from')).toBe('2026-08-03'))
        expect(url()?.get('to')).toBe('2026-08-03')
        // the calendar keeps the open pick, so the next tap ends the period
        expect(result.current.days).toEqual({ from: AUG_3, to: undefined })
        expect(result.current.isComplete).toBe(true)
        expect(mockCapture).not.toHaveBeenCalled()

        act(() => result.current.selectDays({ from: AUG_3, to: AUG_14 }))
        await waitFor(() => expect(url()?.get('to')).toBe('2026-08-14'))
        expect(url()?.get('from')).toBe('2026-08-03')
        expect(result.current.days).toEqual({ from: AUG_3, to: AUG_14 })
        expect(mockCapture).toHaveBeenCalledWith('activity_range_applied', { range_preset: 'custom', range_days: 12 })
    })

    it('stays on custom when the picked days match a preset', () => {
        const dates = presetDates('last7d')!
        const { result } = renderPeriod('?from=2026-08-03&to=2026-08-14')
        act(() =>
            result.current.selectDays({
                from: startOfLocalDay(dates.from),
                to: startOfLocalDay(dates.to),
            })
        )
        expect(result.current.preset).toBe('last7d')
        expect(result.current.option).toBe('custom')
    })

    it('leaves nothing to download after the calendar is cleared, and keeps the URL', async () => {
        const { result, updates } = renderPeriod('?from=2026-08-03&to=2026-08-03')
        act(() => result.current.selectDays(undefined))

        await settle()
        expect(updates).toHaveLength(0)
        expect(result.current.days).toBeUndefined()
        expect(result.current.isComplete).toBe(false)
    })
})
