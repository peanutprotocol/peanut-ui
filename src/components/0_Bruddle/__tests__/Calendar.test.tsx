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

function setup(selected: DateRange | undefined) {
    const onSelect = jest.fn()
    const { container } = render(<Calendar selected={selected} onSelect={onSelect} defaultMonth={AUGUST} />)
    const cell = (day: number) => container.querySelector<HTMLElement>(`[data-day="${iso(day)}"]`)!
    const button = (day: number) => cell(day).querySelector('button')!
    const wrapper = container.firstElementChild as HTMLElement
    return { onSelect, cell, button, wrapper }
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
        expect(cell(15).className).toContain('bg-action-primary')
        expect(cell(16).className).not.toContain('bg-action-primary')
    })

    it('gives a heavy haptic on press', () => {
        const { button } = setup(undefined)
        fireEvent.pointerDown(button(4), { button: 0 })
        fireEvent.pointerUp(window)
        expect(heavyImpactHaptic).toHaveBeenCalledTimes(1)
        expect(impactHaptic).not.toHaveBeenCalled()
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
