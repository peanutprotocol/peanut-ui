// Locks the snap-stick fix: a bill-split slider snapped to 50% must keep
// showing 50% even though the parent re-derives the thumb position from a
// cent-floored amount (e.g. a $33.37 pot → $16.685 → floored $16.68 → 49.98%).
// Konrad: "Snap to 50% bugs out — click 50%, confirm, jumps to 49.98%."
import { render } from '@testing-library/react'
import { Slider } from '../index'

// Radix Slider observes its track size; jsdom has no ResizeObserver.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

describe('Slider snap-stick on sub-cent drift', () => {
    test('keeps the thumb label at 50% when the controlled value drifts to 49.98%', () => {
        const { container, rerender } = render(<Slider value={[50]} onValueChange={() => {}} />)
        expect(container.textContent).toContain('50%')

        // Parent re-derives 49.98% from the cent-floored amount and feeds it back.
        rerender(<Slider value={[49.98]} onValueChange={() => {}} />)
        expect(container.textContent).toContain('50%')
        expect(container.textContent).not.toContain('49.98%')
    })

    test('still syncs a genuine off-snap change (no over-sticking)', () => {
        const { container, rerender } = render(<Slider value={[50]} onValueChange={() => {}} />)
        rerender(<Slider value={[70]} onValueChange={() => {}} />)
        expect(container.textContent).toContain('70%')
        expect(container.textContent).not.toContain('50%')
    })
})
