// Locks in the Disputed-status row copy. Keep changes here in sync with the
// BE's dispute event handler in src/ledger/rain-mapper.ts so the FE label
// always covers every status string the BE may write.

import { disputeStatusLabel } from '../CardPaymentRows'
import { type DisputeStatus } from '@/components/TransactionDetails/transactionTransformer'

const CASES: Array<[DisputeStatus, string]> = [
    ['pending', 'Disputed — Awaiting review'],
    ['inReview', 'Disputed — In review'],
    ['accepted', 'Disputed — Accepted (refund issued)'],
    ['rejected', 'Disputed — Rejected'],
    ['canceled', 'Disputed — Cancelled'],
    ['resolvedByMerchant', 'Disputed — Resolved by merchant refund'],
]

describe('disputeStatusLabel', () => {
    test.each(CASES)('%s → %s', (status: DisputeStatus, label: string) => {
        expect(disputeStatusLabel(status)).toBe(label)
    })
})
