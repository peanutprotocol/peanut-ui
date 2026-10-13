import { fireEvent, render } from '@testing-library/react'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '../Calendar'
import { heavyImpactHaptic, impactHaptic } from '@/utils/haptics'

jest.mock('next-intl', () => ({ useLocale: () => 'en' }))
jest.mock('@/utils/haptics', () => ({ impactHaptic: jest.fn(), heavyImpactHaptic: jest.fn() }))

// August 2026 sits wholly in the past relative to the suite's clock, so every
// day in the grid is selectable
const AUGUST = new Date(2026, 7, 1)
const aug = (day: number) => new Date(2026, 7, day)
const iso = (day: number) => `2026-08-${String(day).padStart(2, '0')}`

function setup(selected: DateRange | undefined, month: Date = AUGUST) {
    const onSelect = jest.fn()
    const { container, getByRole } = render(<Calendar selected={selected} onSelect={onSelect} defaultMonth={month} />)
    const cell = (day: number) => container.querySelector<HTMLElement>(`[data-day="${iso(day)}"]`)!
    const button = (day: number) => cell(day).querySelector('button')!
    const wrapper = container.firstElementChild as HTMLElement
    return { onSelect, cell, button, wrapper, container, getByRole }
}

// jsdom has no layout, so hit-testing is scripted: the "pointer" is over `day`
function pointerOver(cellFor: (day: number) => HTMLElement, day: number) {
    document.elementFromPoint = jest.fn(() => cellFor(day).querySelector('button'))
}

beforeEach(() => {
    jest.clearAllMocks()
})

describe('Calendar — taps', () => {
    it('starts a new range when a day is tapped on a finished range (the reported bug)', () => {
        const { onSelect, button } = setup({ from: aug(3), to: aug(10) })
        fireEvent.click(button(12))
        expect(onSelect).toHaveBeenCalledWith({ from: aug(12), to: undefined })
    })

    it('spans the two taps whichever order they come in', () => {
        const { onSelect, button } = setup({ from: aug(10), to: undefined })
        fireEvent.click(button(3))
        expect(onSelect).toHaveBeenCalledWith({ from: aug(3), to: aug(10) })
    })

    it('clears a single-day range when its own day is tapped again', () => {
        const { onSelect, button } = setup({ from: aug(5), to: aug(5) })
        fireEvent.click(button(5))
        expect(onSelect).toHaveBeenCalledWith(undefined)
    })

    it('highlights the start day while the range has no end yet', () => {
        const { cell } = setup({ from: aug(15), to: undefined })
        expect(cell(15)).toHaveClass('bg-background-selection', 'inset-ring')
        expect(cell(16)).not.toHaveClass('bg-background-selection')
    })

    it('gives a heavy haptic on press', () => {
        const { button } = setup(undefined)
        fireEvent.pointerDown(button(4), { button: 0 })
        fireEvent.pointerUp(window)
        expect(heavyImpactHaptic).toHaveBeenCalledTimes(1)
        expect(impactHaptic).not.toHaveBeenCalled()
    })
})

describe('Calendar — look', () => {
    it('rings the two ends of a range, fills the days between, and leaves the rest alone', () => {
        const { cell } = setup({ from: aug(10), to: aug(14) })
        for (const end of [10, 14]) {
            expect(cell(end)).toHaveClass('bg-background-selection', 'inset-ring', 'inset-ring-border-default')
        }
        expect(cell(12)).toHaveClass('bg-background-selection')
        expect(cell(12)).not.toHaveClass('inset-ring')
        for (const outside of [9, 15]) {
            expect(cell(outside)).not.toHaveClass('bg-background-selection')
            expect(cell(outside)).not.toHaveClass('inset-ring')
        }
    })

    it('shows six week rows in every month, so what sits under the calendar does not move', () => {
        // February 2026 starts on a Sunday and needs four rows only
        const { container } = setup(undefined, new Date(2026, 1, 1))
        expect(container.querySelectorAll('tbody tr')).toHaveLength(6)
    })

    it('marks today with a semibold day number, and dims the arrow that has no month to go to', () => {
        const { container, getByRole } = setup(undefined, new Date())
        const today = container.querySelector('[data-today="true"]')
        expect(today).toHaveClass('[&>button]:text-body-s-semibold')
        // the calendar ends at the current month, so its next arrow is unavailable
        const next = getByRole('button', { name: /next month/i })
        expect(next).toHaveAttribute('aria-disabled', 'true')
        expect(next).toHaveClass('aria-disabled:opacity-40')
    })
})

describe('Calendar — drag', () => {
    it('commits the dragged span on release, with light haptics per crossed day', () => {
        const { onSelect, cell, button, wrapper } = setup({ from: aug(20), to: aug(25) })
        fireEvent.pointerDown(button(3), { button: 0 })
        pointerOver(cell, 5)
        fireEvent.pointerMove(wrapper)
        pointerOver(cell, 7)
        fireEvent.pointerMove(wrapper)
        fireEvent.pointerMove(wrapper) // still on the 7th — no extra haptic
        fireEvent.pointerUp(window)

        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith({ from: aug(3), to: aug(7) })
        expect(impactHaptic).toHaveBeenCalledTimes(2)
        expect(heavyImpactHaptic).toHaveBeenCalledTimes(2) // press + release
    })

    it('selects backwards when dragging to an earlier day', () => {
        const { onSelect, cell, button, wrapper } = setup(undefined)
        fireEvent.pointerDown(button(10), { button: 0 })
        pointerOver(cell, 4)
        fireEvent.pointerMove(wrapper)
        fireEvent.pointerUp(window)
        expect(onSelect).toHaveBeenCalledWith({ from: aug(4), to: aug(10) })
    })

    it('ignores days that cannot be picked while dragging', () => {
        const { onSelect, cell, button, wrapper } = setup(undefined)
        fireEvent.pointerDown(button(3), { button: 0 })
        cell(6).setAttribute('data-disabled', 'true')
        pointerOver(cell, 6)
        fireEvent.pointerMove(wrapper)
        fireEvent.pointerUp(window)
        expect(impactHaptic).not.toHaveBeenCalled()
        expect(onSelect).not.toHaveBeenCalled()
    })

    it('does not let the click after a drag back onto the start day undo the drag', () => {
        const { onSelect, cell, button, wrapper } = setup(undefined)
        fireEvent.pointerDown(button(3), { button: 0 })
        pointerOver(cell, 6)
        fireEvent.pointerMove(wrapper)
        pointerOver(cell, 3)
        fireEvent.pointerMove(wrapper)
        fireEvent.pointerUp(window)
        fireEvent.click(button(3))
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith({ from: aug(3), to: aug(3) })
    })

    it('drops the drag without selecting when the pointer is cancelled', () => {
        const { onSelect, cell, button, wrapper } = setup(undefined)
        fireEvent.pointerDown(button(3), { button: 0 })
        pointerOver(cell, 8)
        fireEvent.pointerMove(wrapper)
        fireEvent.pointerCancel(window)
        expect(onSelect).not.toHaveBeenCalled()
    })
})
