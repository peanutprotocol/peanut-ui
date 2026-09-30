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
const AUG_20 = new Date(2026, 7, 20)

beforeEach(() => mockCapture.mockClear())

describe('useStatementPeriod', () => {
    it('reads no period as all time, with no API bounds', () => {
        const { result } = renderPeriod()
        expect(result.current.option).toBe('allTime')
        expect(result.current.isCustom).toBe(false)
        expect(result.current.fromIso).toBeUndefined()
        expect(result.current.toIso).toBeUndefined()
        expect(result.current.days).toBeUndefined()
        expect(result.current.drawerOpen).toBe(false)
    })

    it('opens a deep-linked period as a custom one, with local-day API bounds and the drawer closed', () => {
        const { result } = renderPeriod('?from=2026-08-03&to=2026-08-14')
        expect(result.current.option).toBe('custom')
        expect(result.current.drawerOpen).toBe(false)
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

    it('reads a URL with only one of the two days as all time, so nothing half-bounded is sent', () => {
        const { result } = renderPeriod('?from=2026-08-03')
        expect(result.current.option).toBe('allTime')
        expect(result.current.days).toBeUndefined()
        expect(result.current.fromIso).toBeUndefined()
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
        expect(mockCapture).toHaveBeenCalledWith('activity_range_applied', {
            range_preset: 'allTime',
            range_days: null,
        })
    })

    it('opens the drawer on "Custom period" and changes nothing until Apply', async () => {
        const dates = presetDates('last30d')!
        const { result, updates } = renderPeriod(`?from=${dates.from}&to=${dates.to}`)
        act(() => result.current.selectOption('custom'))

        expect(result.current.drawerOpen).toBe(true)
        expect(result.current.option).toBe('last30d')
        await settle()
        expect(updates).toHaveLength(0)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it.each([
        ['all time', '', 'allTime'],
        ['a preset', `?from=${presetDates('last30d')!.from}&to=${presetDates('last30d')!.to}`, 'last30d'],
    ])('closing the drawer without Apply keeps %s, never a custom period without days', async (_, search, option) => {
        const { result, updates } = renderPeriod(search)
        act(() => result.current.selectOption('custom'))
        act(() => result.current.closeDrawer())

        expect(result.current.drawerOpen).toBe(false)
        expect(result.current.option).toBe(option)
        expect(result.current.isCustom).toBe(false)
        await settle()
        expect(updates).toHaveLength(0)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it('Apply writes both days, closes the drawer and reports a custom period', async () => {
        const { result, url } = renderPeriod()
        act(() => result.current.selectOption('custom'))
        act(() => result.current.applyDays({ from: AUG_3, to: AUG_14 }))

        expect(result.current.drawerOpen).toBe(false)
        await waitFor(() => expect(url()?.get('from')).toBe('2026-08-03'))
        expect(url()?.get('to')).toBe('2026-08-14')
        expect(result.current.option).toBe('custom')
        expect(result.current.days).toEqual({ from: AUG_3, to: AUG_14 })
        expect(mockCapture).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith('activity_range_applied', { range_preset: 'custom', range_days: 12 })
    })

    it('Apply with only a first day is a one-day period', async () => {
        const { result, url } = renderPeriod()
        act(() => result.current.applyDays({ from: AUG_3 }))

        await waitFor(() => expect(url()?.get('from')).toBe('2026-08-03'))
        expect(url()?.get('to')).toBe('2026-08-03')
        expect(mockCapture).toHaveBeenCalledWith('activity_range_applied', { range_preset: 'custom', range_days: 1 })
    })

    it('stays on "Custom period" when the applied days match a preset', () => {
        const dates = presetDates('last7d')!
        const { result } = renderPeriod('?from=2026-08-03&to=2026-08-14')
        act(() =>
            result.current.applyDays({
                from: startOfLocalDay(dates.from),
                to: startOfLocalDay(dates.to),
            })
        )
        expect(result.current.preset).toBe('last7d')
        expect(result.current.option).toBe('custom')
    })

    it('"Change dates" reopens the drawer on an applied custom period, and a new Apply replaces its days', async () => {
        const { result, url } = renderPeriod('?from=2026-08-03&to=2026-08-14')
        act(() => result.current.openDrawer())
        expect(result.current.drawerOpen).toBe(true)
        expect(result.current.option).toBe('custom')

        act(() => result.current.applyDays({ from: AUG_14, to: AUG_20 }))
        await waitFor(() => expect(url()?.get('from')).toBe('2026-08-14'))
        expect(url()?.get('to')).toBe('2026-08-20')
        expect(result.current.drawerOpen).toBe(false)
    })
})
