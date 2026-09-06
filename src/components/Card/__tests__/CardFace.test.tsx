/**
 * CardFace — registered cardholder name.
 *
 * The name comes from Rain (best-effort) and is shown ONLY in the revealed
 * state, alongside PAN/CVV/expiry. It must never appear on the masked card, and
 * the card must still render when the reveal payload omits the name (backend
 * degraded the Rain lookup).
 */
import React from 'react'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import CardFace, { type RevealedCardDetails } from '@/components/Card/CardFace'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const revealed: RevealedCardDetails = {
    pan: '4111111111111234',
    cvv: '123',
    expiryMonth: 12,
    expiryYear: 2030,
    cardholderName: 'Jane Doe',
}

describe('CardFace copy buttons', () => {
    it('copies the expiry as MM/YY with its own button', () => {
        const onCopy = jest.fn()
        render(<CardFace last4="1234" revealed={revealed} onCopy={onCopy} />)
        fireEvent.click(screen.getByRole('button', { name: 'Copy expiry date' }))
        expect(onCopy).toHaveBeenCalledWith('12/30', 'expiry')
        fireEvent.click(screen.getByRole('button', { name: 'Copy CVV' }))
        expect(onCopy).toHaveBeenCalledWith('123', 'cvv')
    })
})

describe('CardFace cardholder name', () => {
    it('shows the registered name when the card is revealed', () => {
        render(<CardFace last4="1234" revealed={revealed} />)
        const name = screen.getByText('Jane Doe')
        expect(name).toBeInTheDocument()
        // PII guard: the name must stay inside the ph-no-capture wrapper so it's
        // kept out of session recordings — assert the class, not just the text.
        expect(name).toHaveClass('ph-no-capture')
    })

    it('hides the name when the card is masked (not revealed)', () => {
        render(<CardFace last4="1234" revealed={null} />)
        expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    })

    it('still renders the revealed card when the name is absent', () => {
        const { cardholderName: _omitted, ...withoutName } = revealed
        render(<CardFace last4="1234" revealed={withoutName} />)
        expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
        // PAN still renders, proving reveal works without the name.
        expect(screen.getByText('4111 1111 1111 1234')).toBeInTheDocument()
    })
})
