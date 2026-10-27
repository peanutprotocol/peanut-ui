import { render, screen } from '@testing-library/react'
import { HomeCardReceipt } from '../HomeCardReceipt'
import type { HomeCardStrings } from '../homeCard.types'

const STRINGS: HomeCardStrings = {
    lockup: 'Peanut Card',
    knerd: 'In dollars',
    line: 'Spend your Peanut balance with a virtual Visa card.',
    cta: 'Get your card',
    receiptTitle: 'Card purchase',
    receiptApproved: 'Approved',
}

describe('HomeCardReceipt', () => {
    it('shows the canonical "????" card number, never digits', () => {
        render(<HomeCardReceipt strings={STRINGS} locale="en" />)
        const number = screen.getByTestId('home-card-receipt-number')
        expect(number).toHaveTextContent('•••• ????')
        expect(number.textContent).not.toMatch(/\d/)
    })

    it('prints the purchase in the reader’s dollar format', () => {
        render(<HomeCardReceipt strings={STRINGS} locale="pt-br" />)
        expect(screen.getByText((text) => text.replace(/ /g, ' ') === 'USD 24,00')).toBeInTheDocument()
        expect(screen.getByText('Approved')).toBeInTheDocument()
    })
})
