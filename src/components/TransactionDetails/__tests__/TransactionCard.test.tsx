/**
 * TransactionCard — clickable counterparty name.
 *
 * The counterparty name in a history row is a deep-link to that user's
 * profile (to repeat the send/request). The tap must:
 *   1. navigate to `/<username>` (via `profileUrl`) and NOT open the details
 *      drawer — `stopPropagation` keeps the name tap off the card's handler.
 *   2. leave the rest of the card opening the drawer as before.
 *   3. do nothing (no navigation) for an INELIGIBLE row — a link transaction
 *      or a raw 0x-address counterparty has no Peanut profile to link to.
 *
 * The real component is rendered; only leaf hooks/modules that don't matter to
 * the click wiring are mocked (router, haptic, drawer state, ENS lookup, auth).
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import TransactionCard from '../TransactionCard'
import { type TransactionDetails } from '../transactionTransformer'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const push = jest.fn()
const triggerHaptic = jest.fn()
const openTransactionDetails = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
}))

jest.mock('use-haptic', () => ({
    useHaptic: () => ({ triggerHaptic }),
}))

jest.mock('@/hooks/usePrimaryNameServer', () => ({
    usePrimaryNameServer: () => ({ primaryName: undefined }),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }),
}))

// The details drawer is lazy-loaded and never opened in these tests; stub it so
// the async Suspense resolution doesn't emit an act() warning.
jest.mock('../TransactionDetailsDrawer', () => ({
    TransactionDetailsDrawer: () => null,
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
        return React.createElement('img', props as Record<string, string>)
    },
}))

/** a completed payment to username `natalia` — the eligible (clickable) case. */
function eligibleTx(transactionCardType: 'send' | 'bank_request_fulfillment' = 'send'): TransactionDetails {
    return {
        id: 'tx-1',
        direction: transactionCardType === 'bank_request_fulfillment' ? 'bank_request_fulfillment' : 'send',
        status: 'completed',
        userName: 'natalia',
        isPeerActuallyUser: true,
        showFullName: false,
        isVerified: false,
        amount: 10,
        tokenSymbol: 'USDC',
        totalAmountCollected: 0,
        isRequestPotLink: false,
        extraDataForDrawer: {
            transactionCardType,
            isLinkTransaction: false,
        },
    } as unknown as TransactionDetails
}

function renderCard(transaction: TransactionDetails, type: 'send' | 'bank_request_fulfillment' = 'send') {
    return render(
        <TransactionCard
            type={type}
            name="natalia"
            amount={10}
            status="completed"
            transaction={transaction}
            isSelected={false}
            onOpen={openTransactionDetails}
            onClose={jest.fn()}
        />
    )
}

describe('TransactionCard — clickable counterparty name', () => {
    beforeEach(() => {
        push.mockClear()
        triggerHaptic.mockClear()
        openTransactionDetails.mockClear()
    })

    it('AC1: clicking the name navigates to /<username> and does NOT open the drawer', () => {
        renderCard(eligibleTx())

        fireEvent.click(screen.getByText('natalia'))

        expect(push).toHaveBeenCalledWith('/natalia')
        expect(openTransactionDetails).not.toHaveBeenCalled()
    })

    it('AC1b: a bank-fulfilled request payer name navigates to the Peanut profile', () => {
        renderCard(eligibleTx('bank_request_fulfillment'), 'bank_request_fulfillment')

        fireEvent.click(screen.getByText('natalia'))

        expect(push).toHaveBeenCalledWith('/natalia')
        expect(openTransactionDetails).not.toHaveBeenCalled()
    })

    it('AC2: clicking elsewhere on the card (the amount) opens the drawer', () => {
        renderCard(eligibleTx())

        // displayAmount for a completed send of $10 renders as "-$10"
        fireEvent.click(screen.getByText('-$10'))

        expect(openTransactionDetails).toHaveBeenCalledTimes(1)
        expect(push).not.toHaveBeenCalled()
    })

    // Ineligible rows: the name must not be a nav target. Eligibility itself
    // (link tx / raw address / non-user peer / empty username) is exhaustively
    // locked by transaction-predicates.test.ts; here we only confirm the
    // component honors it — one representative ineligible case (a link tx).
    it('AC3 (ineligible — link tx): the name is not a nav target — clicking it does not navigate', () => {
        const tx = eligibleTx()
        ;(tx.extraDataForDrawer as { isLinkTransaction: boolean }).isLinkTransaction = true

        renderCard(tx)

        fireEvent.click(screen.getByText('natalia'))

        expect(push).not.toHaveBeenCalled()
        // the click still bubbles to the card, which opens the drawer
        expect(openTransactionDetails).toHaveBeenCalledTimes(1)
    })
})

/** A Rain card spend row; `cardPayment` overrides shape the flag cases. */
function cardSpendTx(cardPayment: Record<string, unknown>): TransactionDetails {
    const tx = eligibleTx()
    ;(tx.extraDataForDrawer as Record<string, unknown>).cardPayment = {
        merchantName: 'Savannah Taphouse',
        isRefund: false,
        settlementAdjusted: false,
        ...cardPayment,
    }
    return tx
}

// The '· Adjusted' feed flag — settlement cleared at a different amount than
// authorized. Refunds are excluded even when the BE forwards the flag on a
// negative-auth refund clear (they'd read "Refund · Adjusted" otherwise).
describe('TransactionCard — settlement-adjusted flag', () => {
    it('shows · Adjusted for an adjusted card spend', () => {
        renderCard(cardSpendTx({ settlementAdjusted: true }))
        expect(screen.getByText('· Adjusted')).toBeInTheDocument()
    })

    it('hides it for a non-adjusted card spend', () => {
        renderCard(cardSpendTx({ settlementAdjusted: false }))
        expect(screen.queryByText('· Adjusted')).not.toBeInTheDocument()
    })

    it('hides it for an adjusted card REFUND', () => {
        renderCard(cardSpendTx({ settlementAdjusted: true, isRefund: true }))
        expect(screen.queryByText('· Adjusted')).not.toBeInTheDocument()
    })
})

// States board 17966:12128: failed amounts strike through — EXCEPT a failed
// card REFUND (credit still owed to the user; striking it reads as "this
// credit never counted"). Locks the carve-out kept from isDeclinedCardSpend.
describe('TransactionCard — failed strike-through and the refund carve-out', () => {
    function renderFailed(tx: TransactionDetails) {
        const failedTx = { ...tx, status: 'failed' } as TransactionDetails
        return render(
            <TransactionCard
                type="card_pay"
                name="natalia"
                amount={10}
                status="failed"
                transaction={failedTx}
                isSelected={false}
                onOpen={openTransactionDetails}
                onClose={jest.fn()}
            />
        )
    }

    it('strikes the amount of a failed card spend', () => {
        renderFailed(cardSpendTx({}))
        expect(screen.getByText('$10')).toHaveClass('line-through')
    })

    it('does NOT strike the amount of a failed card refund', () => {
        renderFailed(cardSpendTx({ isRefund: true }))
        expect(screen.getByText('$10')).not.toHaveClass('line-through')
    })
})

// PR #2813 review: open requests (unfulfilled request links + pots) never get
// the pending treatment in the feed row — no pending chip, no greyed amount.
// A settling request FULFILMENT (direction receive/send) keeps both.
describe('TransactionCard — open-request pending exemption', () => {
    // the icon-only StatusPill has no text; its pending background class is
    // the stable hook to assert presence/absence
    const pendingPill = (container: HTMLElement) => container.querySelector('.bg-background-badge-attention')

    function pendingTx(overrides: Partial<TransactionDetails>): TransactionDetails {
        return { ...eligibleTx(), status: 'pending', ...overrides } as TransactionDetails
    }

    function renderPending(tx: TransactionDetails, type: 'request' | 'send' | 'receive' = 'request') {
        return render(
            <TransactionCard
                type={type}
                name="natalia"
                amount={10}
                status="pending"
                transaction={tx}
                isSelected={false}
                onOpen={openTransactionDetails}
                onClose={jest.fn()}
            />
        )
    }

    it('shows no pending chip and no greyed amount for an open request', () => {
        const { container } = renderPending(pendingTx({ direction: 'request_received' }))
        expect(pendingPill(container)).toBeNull()
        expect(screen.getByText('-$10')).not.toHaveClass('opacity-40')
    })

    it('exempts request-pot rollups too', () => {
        const { container } = renderPending(pendingTx({ direction: 'receive', isRequestPotLink: true }), 'receive')
        expect(pendingPill(container)).toBeNull()
    })

    it('keeps the pending chip + greyed amount for a real pending payment', () => {
        const { container } = renderPending(pendingTx({ direction: 'send' }), 'send')
        expect(pendingPill(container)).not.toBeNull()
        expect(screen.getByText('-$10')).toHaveClass('opacity-40')
    })
})
