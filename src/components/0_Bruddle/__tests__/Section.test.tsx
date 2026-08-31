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

    test('no title, no heading element', () => {
        render(
            <Section>
                <div>row</div>
            </Section>
        )
        expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
})
