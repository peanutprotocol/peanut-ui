import { parseDayAttribute, rangeBetween, selectableDay } from '../calendar.utils'

describe('calendar.utils', () => {
    it('parses a data-day value as local midnight and rejects anything else', () => {
        expect(parseDayAttribute('2026-08-03')?.getTime()).toBe(new Date(2026, 7, 3).getTime())
        expect(parseDayAttribute('2026-8-3')).toBeNull()
        expect(parseDayAttribute('')).toBeNull()
    })

    it('orders a range whichever day came first', () => {
        const early = new Date(2026, 7, 3)
        const late = new Date(2026, 7, 9)
        expect(rangeBetween(early, late)).toEqual({ from: early, to: late })
        expect(rangeBetween(late, early)).toEqual({ from: early, to: late })
        expect(rangeBetween(early, early)).toEqual({ from: early, to: early })
    })

    it('only treats enabled, visible, in-month cells as selectable', () => {
        const cell = (attrs: Record<string, string>) => {
            const td = document.createElement('td')
            Object.entries(attrs).forEach(([key, value]) => td.setAttribute(key, value))
            return td
        }
        expect(selectableDay(cell({ 'data-day': '2026-08-03' }))?.iso).toBe('2026-08-03')
        expect(selectableDay(cell({ 'data-day': '2026-09-30', 'data-disabled': 'true' }))).toBeNull()
        expect(selectableDay(cell({ 'data-day': '2026-08-03', 'data-hidden': 'true' }))).toBeNull()
        expect(selectableDay(cell({ 'data-day': '2026-07-31', 'data-outside': 'true' }))).toBeNull()
        expect(selectableDay(cell({}))).toBeNull()
        expect(selectableDay(null)).toBeNull()
    })
})
