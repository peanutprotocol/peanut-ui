import React from 'react'
import { render, screen } from '@testing-library/react'
import type { Address } from 'viem'
import { useDirectSendFlowContext, type DirectSendRecipient } from '../DirectSendFlowContext'
import { clearRepeatDraft, offerRepeatDraft, peekRepeatDraft } from '@/features/payments/shared/repeat-draft'

// the input view's own deps (wallet, balance, charges) are not under test:
// it only has to show what the flow context was seeded with
jest.mock('../views/SendInputView', () => ({
    SendInputView: () => {
        const { amount, usdAmount, attachment } = useDirectSendFlowContext()
        return (
            <div>
                <span data-testid="amount">{amount}</span>
                <span data-testid="usd-amount">{usdAmount}</span>
                <span data-testid="message">{attachment.message ?? ''}</span>
            </div>
        )
    },
}))
jest.mock('../views/SendSuccessView', () => ({ SendSuccessView: () => null }))

import { DirectSendPage } from '../DirectSendPage'

const recipient = {
    username: 'hugo',
    address: '0x0000000000000000000000000000000000000001' as Address,
} as DirectSendRecipient

describe('DirectSendPage with a Send again draft (TASK-25462)', () => {
    beforeEach(() => clearRepeatDraft())

    test('seeds the amount and note for the same recipient, then forgets the draft', () => {
        offerRepeatDraft({ to: 'user', username: 'Hugo', amount: '20.5', message: 'Lunch' })

        render(<DirectSendPage recipient={recipient} />)

        expect(screen.getByTestId('amount')).toHaveTextContent('20.5')
        expect(screen.getByTestId('usd-amount')).toHaveTextContent('20.5')
        expect(screen.getByTestId('message')).toHaveTextContent('Lunch')
        // a later send to the same person opens empty
        expect(peekRepeatDraft('user')).toBeNull()
    })

    test('a draft for someone else is not used and stays for them', () => {
        offerRepeatDraft({ to: 'user', username: 'konrad', amount: '12' })

        render(<DirectSendPage recipient={recipient} />)

        expect(screen.getByTestId('amount')).toBeEmptyDOMElement()
        expect(screen.getByTestId('message')).toBeEmptyDOMElement()
        expect(peekRepeatDraft('user')?.username).toBe('konrad')
    })

    test('without a draft the screen opens empty', () => {
        render(<DirectSendPage recipient={recipient} />)

        expect(screen.getByTestId('amount')).toBeEmptyDOMElement()
    })
})
