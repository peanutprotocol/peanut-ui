/**
 * CardFace — registered cardholder name.
 *
 * The name comes from Rain (best-effort) and is shown ONLY in the revealed
 * state, alongside PAN/CVV/expiry. It must never appear on the masked card, and
 * the card must still render when the reveal payload omits the name (backend
 * degraded the Rain lookup).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import CardFace, { type RevealedCardDetails } from '@/components/Card/CardFace'

const revealed: RevealedCardDetails = {
    pan: '4111111111111234',
    cvv: '123',
    expiryMonth: 12,
    expiryYear: 2030,
    cardholderName: 'Jane Doe',
}

describe('CardFace cardholder name', () => {
    it('shows the registered name when the card is revealed', () => {
        render(<CardFace last4="1234" revealed={revealed} />)
        // Revealed details are readOnly inputs (so password managers can save the
        // card), so the value lives on `value`, not text content.
        const name = screen.getByDisplayValue('Jane Doe')
        expect(name).toBeInTheDocument()
        // PII guard: the name field must carry ph-no-capture so it's kept out of
        // session recordings — assert the class, not just the value.
        expect(name).toHaveClass('ph-no-capture')
    })

    it('hides the name when the card is masked (not revealed)', () => {
        render(<CardFace last4="1234" revealed={null} />)
        expect(screen.queryByDisplayValue('Jane Doe')).not.toBeInTheDocument()
    })

    it('still renders the revealed card when the name is absent', () => {
        const { cardholderName: _omitted, ...withoutName } = revealed
        render(<CardFace last4="1234" revealed={withoutName} />)
        expect(screen.queryByDisplayValue('Jane Doe')).not.toBeInTheDocument()
        // PAN still renders, proving reveal works without the name.
        expect(screen.getByDisplayValue('4111 1111 1111 1234')).toBeInTheDocument()
    })

    it('exposes card fields with the autocomplete tokens password managers detect', () => {
        render(<CardFace last4="1234" revealed={revealed} />)
        expect(screen.getByDisplayValue('4111 1111 1111 1234')).toHaveAttribute('autocomplete', 'cc-number')
        expect(screen.getByDisplayValue('Jane Doe')).toHaveAttribute('autocomplete', 'cc-name')
        expect(screen.getByDisplayValue('12/30')).toHaveAttribute('autocomplete', 'cc-exp')
        expect(screen.getByDisplayValue('123')).toHaveAttribute('autocomplete', 'cc-csc')
    })
})
