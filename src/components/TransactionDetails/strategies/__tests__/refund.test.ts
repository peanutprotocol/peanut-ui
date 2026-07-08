// Locks the refund classification at the strategy layer: the `refund`
// strategy (kind=REFUND, any provider) and the `cardSpend` guard that
// re-routes negative-amount spend auths (Rain card refunds arrive as credit
// authorizations under the CARD_SPEND_* kinds). Strategies are pure functions
// of the wire row, so we call them directly.

import { refund } from '../intent/refund'
import { cardSpend } from '../intent/card'
import { type HistoryEntry } from '@/utils/history.utils'

// The strategies read only `entry.amount` + a few `extraData` fields; build
// minimal rows and cast rather than constructing a full HistoryEntry.
const entry = (over: { amount?: string; extraData?: Record<string, unknown> }): HistoryEntry =>
    ({ amount: over.amount ?? '0', extraData: over.extraData ?? {} }) as unknown as HistoryEntry

describe('refund strategy (kind=REFUND)', () => {
    test('RAIN provider → card refund shape ("Refund from {merchant}")', () => {
        const out = refund(entry({ extraData: { provider: 'RAIN', merchantName: 'Acme Coffee' } }))
        expect(out.direction).toBe('receive')
        expect(out.transactionCardType).toBe('refund')
        expect(out.nameForDetails).toBe('Refund from Acme Coffee')
    })

    test('parentRainTxId present but no provider → still the Rain card-refund lane', () => {
        const out = refund(entry({ extraData: { parentRainTxId: 'rain-456', merchantName: 'Acme Coffee' } }))
        expect(out.transactionCardType).toBe('refund')
        expect(out.nameForDetails).toBe('Refund from Acme Coffee')
    })

    test('MANTECA (no Rain signal) → generic "Refund" credit row', () => {
        const out = refund(entry({ extraData: { provider: 'MANTECA' } }))
        expect(out.direction).toBe('receive')
        expect(out.transactionCardType).toBe('refund')
        expect(out.nameForDetails).toBe('Refund')
    })
})

describe('cardSpend refund detection (negative-amount auths)', () => {
    test('negative wire amount → routes to the card-refund shape', () => {
        const out = cardSpend(entry({ amount: '-14.68', extraData: { merchantName: 'Acme Coffee' } }))
        expect(out.direction).toBe('receive')
        expect(out.transactionCardType).toBe('refund')
        expect(out.nameForDetails).toBe('Refund from Acme Coffee')
    })

    test('extraData.isRefund true with a positive amount → card refund (post-PR-2 tolerance)', () => {
        // After PR 2 the BE abs()es the amount, so the sign is gone — the
        // isRefund flag must still route the row to the refund lane.
        const out = cardSpend(entry({ amount: '14.68', extraData: { isRefund: true, merchantName: 'Acme Coffee' } }))
        expect(out.transactionCardType).toBe('refund')
    })

    test('formatted negative amount ("-1,468.00") still routes to refund', () => {
        // Number('-1,468.00') is NaN — detection must sanitize before parsing
        // so locale/currency formatting can never silently drop the route.
        const out = cardSpend(entry({ amount: '-1,468.00', extraData: { merchantName: 'Acme Coffee' } }))
        expect(out.transactionCardType).toBe('refund')
    })

    test('positive spend, no refund signal → unchanged card_pay (regression)', () => {
        const out = cardSpend(entry({ amount: '14.68', extraData: { merchantName: 'Acme Coffee' } }))
        expect(out.transactionCardType).toBe('card_pay')
        expect(out.nameForDetails).toBe('Acme Coffee')
    })
})
