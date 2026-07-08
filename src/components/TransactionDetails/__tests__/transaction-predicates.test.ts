// Locks the kind-keyed predicates so adding a new flow is one line in one
// place rather than a grep-and-edit across the receipt. Wire shape is
// uniform: every entry arrives as `type='TRANSACTION_INTENT'` with
// `extraData.kind` pinned to a canonical TransactionIntentKind value.

import {
    hasUserProfile,
    isCardSpend,
    isDirectSendEntry,
    isFxBearingFlow,
    isMantecaOnrampEntry,
    isOnrampEntry,
    isQRPayment,
    isRequestEntry,
    isSendLinkEntry,
    isSplittable,
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

// Gates the "Split this bill" CTA: a QR payment, or a card spend that went
// through. It's an in-the-moment action right after paying, so a freshly-
// authorized (`pending`) card hold IS splittable — settlement takes days. Only
// charges that didn't stick (refunded/failed/cancelled) are excluded.
describe('isSplittable', () => {
    const txWithStatus = (kind: string, status?: string): TransactionDetails =>
        ({
            status,
            extraDataForDrawer: { originalType: 'TRANSACTION_INTENT', kind },
        }) as unknown as TransactionDetails

    test('QR payments are splittable unless refunded/failed (behaviour unchanged)', () => {
        expect(isSplittable(txWithStatus('QR_PAY', 'completed'))).toBe(true)
        expect(isSplittable(txWithStatus('QR_PAY', 'pending'))).toBe(true)
        expect(isSplittable(txWithStatus('QR_PAY', 'refunded'))).toBe(false)
        expect(isSplittable(txWithStatus('QR_PAY', 'failed'))).toBe(false)
    })

    test('a freshly-authorized (pending) card hold IS splittable — split in the moment, settlement takes days', () => {
        expect(isSplittable(txWithStatus('CARD_SPEND_AUTH', 'pending'))).toBe(true)
    })

    test('settled card spends are splittable', () => {
        expect(isSplittable(txWithStatus('CARD_SPEND_CLEAR', 'completed'))).toBe(true)
        expect(isSplittable(txWithStatus('CARD_SPEND_AUTH', 'completed'))).toBe(true)
    })

    test('a cancelled (reversed/expired) card hold is NOT splittable — the charge never stuck', () => {
        expect(isSplittable(txWithStatus('CARD_SPEND_AUTH', 'cancelled'))).toBe(false)
    })

    test('refunded/failed card spends are NOT splittable', () => {
        expect(isSplittable(txWithStatus('CARD_SPEND_CLEAR', 'refunded'))).toBe(false)
        expect(isSplittable(txWithStatus('CARD_SPEND_CLEAR', 'failed'))).toBe(false)
    })

    test('non-QR / non-card kinds are never splittable', () => {
        expect(isSplittable(txWithStatus('DIRECT_TRANSFER', 'completed'))).toBe(false)
        expect(isSplittable(txWithStatus('SEND_LINK', 'completed'))).toBe(false)
    })
})

// Gates the clickable counterparty name/avatar in BOTH the history row
// (TransactionCard) and the receipt header (TransactionDetailsHeaderCard): only
// a non-link send/request/receive to a real username (not a raw address) deep-
// links to a Peanut profile.
describe('hasUserProfile', () => {
    const profileTx = (
        transactionCardType: string | undefined,
        opts?: { userName?: string; isLinkTransaction?: boolean }
    ): TransactionDetails =>
        ({
            userName: opts?.userName ?? 'natalia',
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                transactionCardType,
                isLinkTransaction: opts?.isLinkTransaction ?? false,
            },
        }) as unknown as TransactionDetails

    test.each(['send', 'request', 'receive'])('a %s to a real username has a profile', (type) => {
        expect(hasUserProfile(profileTx(type))).toBe(true)
    })

    test.each(['withdraw', 'add', 'card_pay', 'bank_withdraw', 'claim_external'])(
        'a %s has no peer profile',
        (type) => {
            expect(hasUserProfile(profileTx(type))).toBe(false)
        }
    )

    test('a link send has no user profile behind it', () => {
        expect(hasUserProfile(profileTx('send', { isLinkTransaction: true }))).toBe(false)
    })

    // Same address rule VerifiedUserLabel renders by (isCryptoAddress): EVM,
    // Solana and Tron shapes all mean "no Peanut profile".
    test.each([
        ['EVM', '0x1bf9c9f2b0e8a0b9f2b0e8a0b9f2b0e8a0b9f2b0'],
        ['Solana', 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy'],
        ['Tron', 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8'],
    ])('a raw %s address recipient has no profile', (_chain, address) => {
        expect(hasUserProfile(profileTx('send', { userName: address }))).toBe(false)
    })

    test('a missing username has no profile', () => {
        expect(hasUserProfile(profileTx('send', { userName: '' }))).toBe(false)
    })
})
