// Locks in the Disputed-status row copy. Keep changes here in sync with the
// BE's dispute event handler in src/ledger/rain-mapper.ts so the FE label
// always covers every status string the BE may write.
//
// The component maps each status to a `transaction.dispute.*` catalog key;
// this asserts the pairing end-to-end against the English catalog.

import { createTranslator } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { DISPUTE_STATUS_KEYS } from '../CardPaymentRows'
import { type DisputeStatus } from '@/components/TransactionDetails/transactionTransformer'

const t = createTranslator({ locale: 'en', messages: en, namespace: 'transaction' })

const CASES: Array<[DisputeStatus, string]> = [
    ['pending', 'Disputed — Awaiting review'],
    ['inReview', 'Disputed — In review'],
    ['accepted', 'Disputed — Accepted (refund issued)'],
    ['rejected', 'Disputed — Rejected'],
    ['canceled', 'Disputed — Cancelled'],
    ['resolvedByMerchant', 'Disputed — Resolved by merchant refund'],
]

describe('dispute status label', () => {
    test.each(CASES)('%s → %s', (status: DisputeStatus, label: string) => {
        expect(t(DISPUTE_STATUS_KEYS[status])).toBe(label)
    })
})
