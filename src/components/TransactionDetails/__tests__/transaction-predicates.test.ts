// Locks the legacy / TRANSACTION_INTENT dual-shape predicates so adding a new
// flow only needs to extend the predicate, not grep the whole receipt for
// `originalType === EHistoryEntryType.X` chains. If you're tempted to inline
// such a check elsewhere — write a predicate here instead and lock it below.
import {
    isDirectSendEntry,
    isMantecaOnrampEntry,
    isOnrampEntry,
    isRequestEntry,
    isSendLinkEntry,
} from '../transaction-predicates'
import type { TransactionDetails } from '../transactionTransformer'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '', SIMPLEFI: '' }))

const tx = (originalType: string, kind?: string): TransactionDetails =>
    ({
        extraDataForDrawer: { originalType, ...(kind ? { kind } : {}) },
    }) as unknown as TransactionDetails

// Source of truth: the BE's `toLegacyKindLabel` in
// peanut-api-ts/src/ledger/card-spend.ts. If either side changes, update both
// the predicate AND this table — that's the contract the predicate enforces.
const WIRE_SHAPES: Array<{
    predicate: (t: TransactionDetails) => boolean
    legacyTypes: string[]
    intentKind: string
    name: string
}> = [
    { predicate: isSendLinkEntry, legacyTypes: ['SEND_LINK'], intentKind: 'LINK_CREATE', name: 'isSendLinkEntry' },
    { predicate: isRequestEntry, legacyTypes: ['REQUEST'], intentKind: 'REQUEST_PAY', name: 'isRequestEntry' },
    {
        predicate: isOnrampEntry,
        legacyTypes: ['BRIDGE_ONRAMP', 'MANTECA_ONRAMP'],
        intentKind: 'FIAT_ONRAMP',
        name: 'isOnrampEntry',
    },
    {
        predicate: isMantecaOnrampEntry,
        legacyTypes: ['MANTECA_ONRAMP'],
        intentKind: 'FIAT_ONRAMP',
        name: 'isMantecaOnrampEntry',
    },
    { predicate: isDirectSendEntry, legacyTypes: ['DIRECT_SEND'], intentKind: 'P2P_SEND', name: 'isDirectSendEntry' },
]

describe('entry-type predicates — legacy + TRANSACTION_INTENT dual shape', () => {
    for (const { predicate, legacyTypes, intentKind, name } of WIRE_SHAPES) {
        for (const legacy of legacyTypes) {
            test(`${name} matches legacy ${legacy}`, () => {
                expect(predicate(tx(legacy))).toBe(true)
            })
        }

        test(`${name} matches TRANSACTION_INTENT + kind=${intentKind}`, () => {
            expect(predicate(tx('TRANSACTION_INTENT', intentKind))).toBe(true)
        })

        test(`${name} does NOT match TRANSACTION_INTENT with a different kind`, () => {
            expect(predicate(tx('TRANSACTION_INTENT', 'SOME_OTHER_KIND'))).toBe(false)
        })

        test(`${name} does NOT match an unrelated legacy type`, () => {
            expect(predicate(tx('UNRELATED_TYPE'))).toBe(false)
        })
    }

    // Regression: until this PR, the dual-shape onramp checks in
    // useReceiptViewModel used `kind === 'ONRAMP'` literally — but the BE's
    // toLegacyKindLabel renames TransactionIntentKind.ONRAMP → 'FIAT_ONRAMP',
    // so every post-decomplexify onramp silently fell through the gate. Lock
    // the correct kind string so a future copy-paste doesn't re-introduce it.
    test('isOnrampEntry uses FIAT_ONRAMP, not raw ONRAMP', () => {
        expect(isOnrampEntry(tx('TRANSACTION_INTENT', 'ONRAMP'))).toBe(false)
        expect(isOnrampEntry(tx('TRANSACTION_INTENT', 'FIAT_ONRAMP'))).toBe(true)
    })

    // The cancel-by-sender SEND_LINK_CLAIM intent is also rendered as
    // wire-kind LINK_CREATE (per toLegacyKindLabel collapsing SEND_LINK +
    // SEND_LINK_CLAIM). isSendLinkEntry returns true for it — that's how
    // the receipt-field exemption fires for "sender cancelled their own link".
    test('isSendLinkEntry matches the SEND_LINK_CLAIM cancel-by-sender row (rendered as LINK_CREATE)', () => {
        expect(isSendLinkEntry(tx('TRANSACTION_INTENT', 'LINK_CREATE'))).toBe(true)
    })
})
