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

jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        isDrawerOpen: false,
        selectedTransaction: null,
        openTransactionDetails,
        closeTransactionDetails: jest.fn(),
    }),
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
        <TransactionCard type={type} name="natalia" amount={10} status="completed" transaction={transaction} />
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

// TASK-21887: a received request is inbound money (the viewer created the
// request), so the row must carry the inbound arrow and the + sign — it used
// to render the outbound arrow with a negative amount.
describe('TransactionCard — received request renders as inbound', () => {
    function requestTx(): TransactionDetails {
        const tx = eligibleTx()
        tx.direction = 'request_received'
        tx.status = 'pending'
        ;(tx.extraDataForDrawer as { transactionCardType: string }).transactionCardType = 'request'
        return tx
    }

    it('draws the inbound arrow and a positive amount', () => {
        const { container } = render(
            <TransactionCard type="request" name="natalia" amount={10} status="pending" transaction={requestTx()} />
        )

        expect(container.querySelector('svg.lucide-arrow-down-left')).not.toBeNull()
        expect(container.querySelector('svg.lucide-arrow-up-right')).toBeNull()
        expect(screen.getByText('+$10')).toBeInTheDocument()
    })
})

// TASK-20700: `truncate`/`line-clamp` only engage when every flex ancestor can
// shrink (min-w-0) and the amount block refuses to (shrink-0). Locks the class
// chain so a long name can never push the amount off the card.
describe('TransactionCard — long-name overflow containment', () => {
    it('keeps a min-w-0 chain around the name and shrink-0 on the amount block', () => {
        renderCard(eligibleTx())

        const nameEl = screen.getByText('natalia')
        const card = nameEl.closest('[data-testid="transaction-card"]') as HTMLElement

        const row = card.querySelector(':scope > div') as HTMLElement
        expect(row.className).toContain('min-w-0')

        const leftCluster = row.querySelector(':scope > div') as HTMLElement
        expect(leftCluster.className).toContain('min-w-0')
        expect(leftCluster.className).toContain('flex-1')

        // every flex ancestor between the left cluster and the name can shrink
        let node = nameEl.parentElement
        const flexAncestors: HTMLElement[] = []
        while (node && node !== leftCluster) {
            if (node.className.includes('flex')) flexAncestors.push(node)
            node = node.parentElement
        }
        expect(flexAncestors.length).toBeGreaterThan(0)
        flexAncestors.forEach((el) => expect(el.className).toContain('min-w-0'))

        const amountBlock = screen.getByText('-$10').closest('.shrink-0')
        expect(amountBlock).not.toBeNull()
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
