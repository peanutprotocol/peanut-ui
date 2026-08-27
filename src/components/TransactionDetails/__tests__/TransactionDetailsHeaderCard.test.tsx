import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { TransactionDetailsHeaderCard } from '../TransactionDetailsHeaderCard'

const push = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

jest.mock('../TransactionAvatarBadge', () => ({
    __esModule: true,
    default: ({ countryCode }: { countryCode?: string | null }) => (
        <span data-testid="transaction-avatar">{countryCode ? 'bank flag' : 'user initials'}</span>
    ),
}))

jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name, onNameClick }: { name: string; onNameClick?: () => void }) => (
        <button type="button" onClick={onNameClick}>
            {name}
        </button>
    ),
}))

const renderHeader = (props: { isNameClickable: boolean; isAvatarClickable: boolean; bank?: boolean }) =>
    render(
        <TransactionDetailsHeaderCard
            direction={props.bank ? 'bank_request_fulfillment' : 'send'}
            userName="natalia"
            amountDisplay="$25.00"
            initials="N"
            status="completed"
            transactionType={props.bank ? 'bank_request_fulfillment' : 'send'}
            countryCode={props.bank ? 'US' : undefined}
            isNameClickable={props.isNameClickable}
            isAvatarClickable={props.isAvatarClickable}
        />,
        { wrapper: IntlWrapper }
    )

const renderHeaderCard = (props: Partial<React.ComponentProps<typeof TransactionDetailsHeaderCard>>) =>
    render(
        <TransactionDetailsHeaderCard
            direction="send"
            userName="natalia"
            amountDisplay="$25.00"
            initials="N"
            {...props}
        />,
        { wrapper: IntlWrapper }
    )

// PR #2813 review: inflow/outflow must be readable from the receipt words —
// the sign alone is not enough. These lock the direction-worded titles for
// the cases that used to fall back to the bare counterparty name.
describe('TransactionDetailsHeaderCard direction words', () => {
    it('keeps "Sending to" on a pending send (no bare-name fallback)', () => {
        renderHeaderCard({ direction: 'send', status: 'pending' })
        expect(screen.getByText('Sending to natalia')).toBeInTheDocument()
    })

    it('keeps "Sending to" on a cancelled send', () => {
        renderHeaderCard({ direction: 'send', status: 'cancelled' })
        expect(screen.getByText('Sending to natalia')).toBeInTheDocument()
    })

    it('words a failed card spend as "Payment to {merchant}"', () => {
        renderHeaderCard({ direction: 'qr_payment', status: 'failed', userName: 'Trader Joe S #225' })
        expect(screen.getByText('Payment to Trader Joe S #225')).toBeInTheDocument()
    })

    it('keeps "Paid to" on a PENDING card/QR payment (board: badge carries the state, not the verb)', () => {
        renderHeaderCard({ direction: 'qr_payment', status: 'pending', userName: 'Museumsinsel' })
        expect(screen.getByText('Paid to Museumsinsel')).toBeInTheDocument()
    })

    it('leaves the self-contained failed-QR label unprefixed', () => {
        renderHeaderCard({
            direction: 'qr_payment',
            status: 'failed',
            userName: 'Failed QR payment attempt',
            nameKey: 'name.failedQrPayment',
        })
        expect(screen.getByText('Failed QR payment attempt')).toBeInTheDocument()
    })

    it('words a bank request fulfillment as a send', () => {
        renderHeaderCard({ direction: 'bank_request_fulfillment', status: 'completed' })
        expect(screen.getByText('Sent to natalia')).toBeInTheDocument()
    })
})

// PR #2813 review: open requests are exempt from the pending treatment — no
// pending badge and no greyed amount. Money is not in flight for an open
// request; a settling fulfilment (direction receive/send) keeps the treatment.
describe('TransactionDetailsHeaderCard open-request pending exemption', () => {
    it('shows no pending badge and no greyed amount for a pending request', () => {
        renderHeaderCard({ direction: 'request_received', status: 'pending', userName: 'Request' })
        expect(screen.queryByText('Pending')).not.toBeInTheDocument()
        expect(screen.getByText('$25.00')).not.toHaveClass('text-foreground-secondary')
    })

    it('exempts pending request pots too', () => {
        renderHeaderCard({
            direction: 'receive',
            status: 'pending',
            userName: 'Request',
            isRequestPotTransaction: true,
        })
        expect(screen.queryByText('Pending')).not.toBeInTheDocument()
        expect(screen.getByText('$25.00')).not.toHaveClass('text-foreground-secondary')
    })

    it('keeps the pending badge + greyed amount for a real pending payment', () => {
        renderHeaderCard({ direction: 'send', status: 'pending' })
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('$25.00')).toHaveClass('text-foreground-secondary')
    })
})

describe('TransactionDetailsHeaderCard profile navigation', () => {
    beforeEach(() => {
        push.mockClear()
    })

    it('links the counterparty name but leaves a bank flag inert', () => {
        renderHeader({ bank: true, isNameClickable: true, isAvatarClickable: false })

        fireEvent.click(screen.getByTestId('transaction-avatar'))
        expect(push).not.toHaveBeenCalled()

        // bank_request_fulfillment titles as a send now — "Sent to natalia"
        fireEvent.click(screen.getByRole('button', { name: 'Sent to natalia' }))
        expect(push).toHaveBeenCalledWith('/natalia')
    })

    it('links a real user avatar or initials', () => {
        renderHeader({ isNameClickable: true, isAvatarClickable: true })

        fireEvent.click(screen.getByTestId('transaction-avatar'))
        expect(push).toHaveBeenCalledWith('/natalia')
    })

    it('leaves the rest of the receipt header inert', () => {
        renderHeader({ isNameClickable: true, isAvatarClickable: true })

        fireEvent.click(screen.getByText('$25.00'))
        expect(push).not.toHaveBeenCalled()
    })
})
