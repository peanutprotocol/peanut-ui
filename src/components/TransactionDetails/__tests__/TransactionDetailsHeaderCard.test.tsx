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

// The real VerifiedUserLabel renders here (it used to be mocked, which hid
// the bug where its AddressLink lane discarded the worded title for
// raw-address usernames). Only its data hooks are stubbed.
let mockPrimaryName: string | undefined
jest.mock('@/hooks/usePrimaryNameServer', () => ({
    usePrimaryNameServer: () => ({ primaryName: mockPrimaryName }),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }),
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

beforeEach(() => {
    mockPrimaryName = undefined
})

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
        fireEvent.click(screen.getByText('Sent to natalia'))
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

const EVM_ADDRESS = '0x1234567890AbcdEF1234567890aBcdef12345678'

// The reported PR #2813 bug: for raw-address usernames VerifiedUserLabel
// rendered its AddressLink lane and DISCARDED the worded title — a crypto
// deposit receipt showed only the ENS-resolved sender, no "Added from".
// These run against the real VerifiedUserLabel (no mock) so the composition
// stays locked.
describe('TransactionDetailsHeaderCard address counterparties keep the wording', () => {
    it('words a deposit from an ENS-resolving address as "Added from {ens}"', () => {
        mockPrimaryName = 'kushagra.peanut.me'
        renderHeaderCard({ direction: 'add', status: 'completed', userName: EVM_ADDRESS })
        expect(screen.getByText('Added from kushagra.peanut.me')).toBeInTheDocument()
    })

    it('falls back to the shortened raw address when no ENS resolves', () => {
        renderHeaderCard({ direction: 'add', status: 'completed', userName: EVM_ADDRESS })
        expect(screen.getByText('Added from 0x1234...345678')).toBeInTheDocument()
    })
})

// Self-describing labels must render bare — never interpolated into
// direction wording ("Sending to Send didn't complete").
describe('TransactionDetailsHeaderCard self-describing labels', () => {
    it('renders reaper fail copy bare on a failed withdraw', () => {
        renderHeaderCard({
            direction: 'withdraw',
            status: 'failed',
            userName: "Withdrawal didn't complete",
            nameKey: 'failReason.cryptoWithdrawTimeout',
        })
        expect(screen.getByText("Withdrawal didn't complete")).toBeInTheDocument()
        expect(screen.queryByText(/Withdrawing to/)).not.toBeInTheDocument()
    })

    it('renders a card refund bare, not "Received from Refund from …"', () => {
        renderHeaderCard({
            direction: 'receive',
            status: 'completed',
            userName: 'Refund from Starbucks',
            nameKey: 'name.refundFrom',
            nameParams: { name: 'Starbucks' },
        })
        expect(screen.getByText('Refund from Starbucks')).toBeInTheDocument()
        expect(screen.queryByText(/Received from/)).not.toBeInTheDocument()
    })

    it("words the user's own open request pot as 'You requested'", () => {
        renderHeaderCard({
            direction: 'request_received',
            status: 'pending',
            userName: 'Request',
            nameKey: 'name.request',
            isRequestPotTransaction: true,
        })
        expect(screen.getByText('You requested')).toBeInTheDocument()
    })

    it('keeps an unresolved incoming request as bare "Request", never "You requested"', () => {
        renderHeaderCard({
            direction: 'request_received',
            status: 'pending',
            userName: 'Request',
            nameKey: 'name.request',
        })
        expect(screen.getByText('Request')).toBeInTheDocument()
        expect(screen.queryByText('You requested')).not.toBeInTheDocument()
        expect(screen.queryByText(/is requesting/)).not.toBeInTheDocument()
    })
})
