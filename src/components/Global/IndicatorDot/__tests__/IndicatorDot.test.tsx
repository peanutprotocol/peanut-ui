/**
 * Visual-parity guard for the dot extraction.
 *
 * The same pink dot used to be copy-pasted in three places. Collapsing them
 * onto one component is only safe if each call site still resolves to the
 * classes it had before — twMerge has to win the size and animation overrides
 * rather than emit both. Asserting the resolved class string pins that more
 * precisely than a screenshot of a 10px dot could.
 */
import { render } from '@testing-library/react'
import IndicatorDot from '@/components/Global/IndicatorDot'

const classesOf = (ui: React.ReactElement) => {
    const { container } = render(ui)
    return (container.firstChild as HTMLElement).className.split(/\s+/)
}

describe('IndicatorDot', () => {
    it('renders the shared 10px pink dot by default (perk carousel call site)', () => {
        const classes = classesOf(<IndicatorDot />)
        expect(classes).toEqual(expect.arrayContaining(['block', 'h-2.5', 'w-2.5', 'rounded-full', 'bg-primary-1']))
    })

    it('lets a call site shrink the dot without leaving the old size behind', () => {
        // TransactionCard's pending dot: h-2 w-2 animate-pulsate.
        const classes = classesOf(<IndicatorDot className="h-2 w-2 animate-pulsate" />)
        expect(classes).toEqual(expect.arrayContaining(['h-2', 'w-2', 'animate-pulsate', 'bg-primary-1']))
        expect(classes).not.toContain('h-2.5')
        expect(classes).not.toContain('w-2.5')
    })

    it('keeps the profile menu highlight animating and labelled', () => {
        const { container } = render(<IndicatorDot className="animate-pulse" aria-label="highlight-indicator" />)
        const dot = container.firstChild as HTMLElement
        expect(dot.className.split(/\s+/)).toEqual(expect.arrayContaining(['animate-pulse', 'h-2.5', 'w-2.5']))
        expect(dot).toHaveAttribute('aria-label', 'highlight-indicator')
    })

    it('positions the support nav badge without dropping the dot styling', () => {
        const classes = classesOf(<IndicatorDot className="absolute -top-1 -right-1" />)
        expect(classes).toEqual(
            expect.arrayContaining(['absolute', '-right-1', '-top-1', 'h-2.5', 'w-2.5', 'bg-primary-1'])
        )
    })

    it('announces the support badge to assistive tech', () => {
        // aria-label on a bare span (generic role) is ignored, so the nav badge
        // pairs it with role="status".
        const { getByRole } = render(<IndicatorDot role="status" aria-label="New support reply" />)
        expect(getByRole('status')).toHaveAttribute('aria-label', 'New support reply')
    })
})
