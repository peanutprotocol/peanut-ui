import { render, screen } from '@testing-library/react'
import { PersonaFold } from '../PersonaFold'
import { STAR_LP_EARNERS } from '../starLpPersonas.consts'

const designer = { ...STAR_LP_EARNERS.designer, line: 'A Berlin agency pays me in euros.' }
const developer = { ...STAR_LP_EARNERS.developer, line: 'My salary comes from a US employer.' }

describe('PersonaFold', () => {
    it('keeps the star-LP title and the fact pill when cards carry a tag', () => {
        render(
            <PersonaFold
                cards={[
                    { ...designer, tag: 'SEPA' },
                    { ...developer, tag: 'ACH' },
                ]}
            />
        )
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sound like you?')
        expect(screen.getByText('SEPA')).toBeInTheDocument()
        expect(screen.getByText('ACH')).toBeInTheDocument()
    })

    it('takes a localized title and draws no pill for a card without a tag', () => {
        render(<PersonaFold title="¿Te suena?" cards={[designer, developer]} />)
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('¿Te suena?')
        const cards = screen.getAllByRole('article')
        expect(cards).toHaveLength(2)
        // each card holds the trade line and the first-person line only
        for (const card of cards) expect(card.querySelectorAll('p')).toHaveLength(2)
    })

    it('lays two cards out as a capped pair, never a four-slot row with empty cells', () => {
        const { container, rerender } = render(<PersonaFold cards={[designer, developer]} />)
        const list = () => container.querySelector('ul')!
        expect(list().className).toContain('md:grid-cols-2')
        expect(list().className).not.toContain('xl:grid-cols-4')
        rerender(
            <PersonaFold
                cards={[designer, developer, designer, developer].map((c, i) => ({ ...c, who: `${c.who} ${i}` }))}
            />
        )
        expect(list().className).toContain('xl:grid-cols-4')
    })
})
