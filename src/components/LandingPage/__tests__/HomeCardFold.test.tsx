import { render, screen } from '@testing-library/react'
import { HomeCardFold } from '../HomeCardFold'
import type { HomeCardStrings } from '../homeCard.types'

const STRINGS: HomeCardStrings = {
    lockup: 'Peanut Card',
    knerd: 'In dollars',
    line: 'Spend your Peanut balance with a virtual Visa card.',
    cta: 'Get your card',
    receiptTitle: 'Card purchase',
    receiptApproved: 'Approved',
}

describe('HomeCardFold', () => {
    it('has one link, the CTA to the card page with the marketing motion layer', () => {
        const { container } = render(<HomeCardFold strings={STRINGS} locale="en" />)
        const links = container.querySelectorAll('a')
        expect(links).toHaveLength(1)
        const cta = screen.getByRole('link', { name: 'Get your card' })
        expect(cta).toHaveAttribute('href', '/peanut-card')
        expect(cta).toHaveClass('cta-motion', 'w-fit')
        expect(container.querySelector('a[href^="/setup"]')).toBeNull()
    })

    it('keeps the old #peanut-card anchor and hides the decorative art', () => {
        const { container } = render(<HomeCardFold strings={STRINGS} locale="en" />)
        expect(container.querySelector('section#peanut-card')).not.toBeNull()
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Peanut Card/)
        expect(screen.getByText('Approved').closest('[aria-hidden]')).not.toBeNull()
    })
})
