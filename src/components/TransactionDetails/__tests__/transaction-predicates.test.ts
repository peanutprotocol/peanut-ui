// Locks the kind-keyed predicates so adding a new flow is one line in one
// place rather than a grep-and-edit across the receipt. Wire shape is
// uniform: every entry arrives as `type='TRANSACTION_INTENT'` with
// `extraData.kind` pinned to a canonical TransactionIntentKind value.

import {
    isCardSpend,
    isDirectSendEntry,
    isFxBearingFlow,
    isMantecaOnrampEntry,
    isOnrampEntry,
    isQRPayment,
    isRequestEntry,
    isSendLinkEntry,
    hasShareableReceipt,
} from '../transaction-predicates'
import type { TransactionDetails } from '../transactionTransformer'
import type { IntentKind } from '../strategies/registry'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '', SIMPLEFI: '' }))

const tx = (kind: string, extra?: Record<string, unknown>): TransactionDetails =>
    ({
        extraDataForDrawer: { originalType: 'TRANSACTION_INTENT', kind, ...(extra ?? {}) },
    }) as unknown as TransactionDetails

interface KindCase {
    predicate: (t: TransactionDetails) => boolean
    intentKind: IntentKind
    name: string
    requiresProvider?: string
}

const KIND_PREDICATES: KindCase[] = [
    { predicate: isSendLinkEntry, intentKind: 'SEND_LINK', name: 'isSendLinkEntry' },
    { predicate: isRequestEntry, intentKind: 'P2P_REQUEST_FULFILL', name: 'isRequestEntry' },
    { predicate: isDirectSendEntry, intentKind: 'DIRECT_TRANSFER', name: 'isDirectSendEntry' },
    { predicate: isOnrampEntry, intentKind: 'ONRAMP', name: 'isOnrampEntry' },
    { predicate: isQRPayment, intentKind: 'QR_PAY', name: 'isQRPayment' },
    {
        predicate: isMantecaOnrampEntry,
        intentKind: 'ONRAMP',
        name: 'isMantecaOnrampEntry',
        requiresProvider: 'MANTECA',
    },
]

describe('entry-kind predicates', () => {
    for (const { predicate, intentKind, name, requiresProvider } of KIND_PREDICATES) {
        const intentExtra = requiresProvider ? { provider: requiresProvider } : undefined

        test(`${name} matches kind=${intentKind}${requiresProvider ? ` + provider=${requiresProvider}` : ''}`, () => {
            expect(predicate(tx(intentKind, intentExtra))).toBe(true)
        })

        test(`${name} does NOT match a different kind`, () => {
            expect(predicate(tx('SOME_OTHER_KIND', intentExtra))).toBe(false)
        })

        if (requiresProvider) {
            test(`${name} does NOT match correct kind with a different provider`, () => {
                expect(predicate(tx(intentKind, { provider: 'BRIDGE' }))).toBe(false)
            })

            test(`${name} does NOT match correct kind with NO provider`, () => {
                expect(predicate(tx(intentKind))).toBe(false)
            })
        }
    }

    test('hasShareableReceipt matches QR_PAY, ONRAMP, and OFFRAMP', () => {
        expect(hasShareableReceipt(tx('QR_PAY'))).toBe(true)
        expect(hasShareableReceipt(tx('ONRAMP'))).toBe(true)
        expect(hasShareableReceipt(tx('OFFRAMP'))).toBe(true)
    })

    test('hasShareableReceipt does NOT match unrelated kinds', () => {
        expect(hasShareableReceipt(tx('DIRECT_TRANSFER'))).toBe(false)
        expect(hasShareableReceipt(tx('SEND_LINK'))).toBe(false)
    })

    // Gates the "Split this bill" CTA — must fire on real card spends only,
    // never on refunds or auth reversals (you didn't pay those).
    test('isCardSpend matches CARD_SPEND_AUTH + CARD_SPEND_CLEAR only', () => {
        expect(isCardSpend(tx('CARD_SPEND_AUTH'))).toBe(true)
        expect(isCardSpend(tx('CARD_SPEND_CLEAR'))).toBe(true)
        expect(isCardSpend(tx('CARD_AUTH_REVERSAL'))).toBe(false)
        expect(isCardSpend(tx('REFUND'))).toBe(false)
        expect(isCardSpend(tx('QR_PAY'))).toBe(false)
    })

    describe('isFxBearingFlow', () => {
        test.each(['ONRAMP', 'OFFRAMP', 'QR_PAY'])('matches fiat-rail kind=%s', (kind) => {
            expect(isFxBearingFlow(tx(kind))).toBe(true)
        })

        test('matches any card entry regardless of kind (cardPayment block present)', () => {
            // Card spends (CARD_SPEND_*) and refunds (direction `receive`) both
            // carry a cardPayment block — that's what kept refunds eligible.
            expect(isFxBearingFlow(tx('CARD_SPEND_CLEAR', { cardPayment: { isRefund: false } }))).toBe(true)
            expect(isFxBearingFlow(tx('CARD_AUTH_REVERSAL', { cardPayment: { isRefund: true } }))).toBe(true)
        })

        test('does NOT match non-FX flows', () => {
            expect(isFxBearingFlow(tx('DIRECT_TRANSFER'))).toBe(false)
            expect(isFxBearingFlow(tx('SEND_LINK'))).toBe(false)
            expect(isFxBearingFlow(tx('CRYPTO_WITHDRAW'))).toBe(false)
        })
    })
})
