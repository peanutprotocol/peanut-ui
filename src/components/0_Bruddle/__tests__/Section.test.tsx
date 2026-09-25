import { render, screen } from '@testing-library/react'
import { Section } from '../Section'

describe('Section', () => {
    test('renders the title as an h2 with the heading token', () => {
        render(
            <Section title="Unlocked regions">
                <div>row</div>
            </Section>
        )
        const heading = screen.getByRole('heading', { level: 2, name: 'Unlocked regions' })
        expect(heading).toHaveClass('text-heading-card')
        expect(screen.getByText('row')).toBeInTheDocument()
    })

    test('trailing sits on the title row and stays out of the heading name', () => {
        render(
            <Section title="Select a network" trailing={<button>More networks</button>}>
                <div>row</div>
            </Section>
        )
        // the action must not be absorbed into the h2's accessible name —
        // that is why trailing renders as a sibling, not a child, of the heading
        const heading = screen.getByRole('heading', { level: 2, name: 'Select a network' })
        const action = screen.getByRole('button', { name: 'More networks' })
        expect(heading).not.toContainElement(action)
        // and they share one row, so the action never drops to its own line
        expect(heading.parentElement).toBe(action.parentElement)
    })

    test('with no title, trailing sits alone at the right of its row', () => {
        render(
            <Section trailing={<span>1 of 2 used</span>}>
                <div>row</div>
            </Section>
        )
        expect(screen.queryByRole('heading')).not.toBeInTheDocument()
        expect(screen.getByText('1 of 2 used').parentElement).toHaveClass('justify-end')
    })

    test('no title, no heading element', () => {
        render(
            <Section>
                <div>row</div>
            </Section>
        )
        expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
})
