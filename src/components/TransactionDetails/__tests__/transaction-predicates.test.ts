// Locks the kind-keyed predicates so adding a new flow is one line in one
// place rather than a grep-and-edit across the receipt. Wire shape is
// uniform: every entry arrives as `type='TRANSACTION_INTENT'` with
// `extraData.kind` pinned to a canonical TransactionIntentKind value.

import {
    hasReferralNudge,
    hasUserProfile,
    hasUserProfileAvatar,
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
import type { TransactionDirection } from '../transaction-types'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

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

describe('hasReferralNudge', () => {
    const nudgeTx = (kind: string, direction: TransactionDirection): TransactionDetails =>
        ({
            direction,
            extraDataForDrawer: { originalType: 'TRANSACTION_INTENT', kind },
        }) as unknown as TransactionDetails

    // Every IntentKind × the direction it renders for the payer. Keyed by
    // IntentKind (not an array) so a new kind is a TS error until someone
    // decides its nudge status here.
    const NUDGE_BY_KIND: Record<IntentKind, { direction: TransactionDirection; expected: boolean }> = {
        DIRECT_TRANSFER: { direction: 'send', expected: true },
        SEND_LINK: { direction: 'send', expected: true },
        SEND_LINK_CLAIM: { direction: 'send', expected: true },
        P2P_REQUEST_FULFILL: { direction: 'send', expected: true },
        QR_PAY: { direction: 'qr_payment', expected: true },
        CRYPTO_WITHDRAW: { direction: 'withdraw', expected: true },
        OFFRAMP: { direction: 'bank_withdraw', expected: true },
        CARD_SPEND_AUTH: { direction: 'qr_payment', expected: true },
        CARD_SPEND_CLEAR: { direction: 'qr_payment', expected: true },
        CARD_AUTH_REVERSAL: { direction: 'qr_payment', expected: false },
        ONRAMP: { direction: 'bank_deposit', expected: false },
        CRYPTO_DEPOSIT: { direction: 'add', expected: false },
        REFUND: { direction: 'receive', expected: false },
        PERK_REWARD: { direction: 'receive', expected: false },
        // TASK-21817: IntentKind now derives from the generated wire
        // vocabulary — the four ledger kinds get explicit nudge verdicts.
        P2P_SEND: { direction: 'send', expected: true }, // legacy sends behave like DIRECT_TRANSFER
        REWARD_PAYOUT: { direction: 'receive', expected: false },
        INTERNAL_TRANSFER: { direction: 'send', expected: false },
        CHARGEBACK: { direction: 'send', expected: false },
    }

    test.each(Object.entries(NUDGE_BY_KIND).map(([kind, row]) => ({ kind, ...row })))(
        'kind=$kind direction=$direction → $expected',
        ({ kind, direction, expected }) => {
            expect(hasReferralNudge(nudgeTx(kind, direction))).toBe(expected)
        }
    )

    // Role-polymorphic kinds: the SAME kind renders a different direction for the
    // receiving side, which must never be nudged for a payment it did not make.
    test.each([
        ['CRYPTO_WITHDRAW seen by the recipient', 'CRYPTO_WITHDRAW', 'add'],
        ['a claimed SEND_LINK seen by the claimer', 'SEND_LINK', 'claim_external'],
        ['a request seen by the requester', 'P2P_REQUEST_FULFILL', 'request_received'],
    ] as Array<[string, string, TransactionDirection]>)('%s gets no nudge', (_label, kind, direction) => {
        expect(hasReferralNudge(nudgeTx(kind, direction))).toBe(false)
    })

    test('a bank send-link claim gets no nudge (viewer role is ambiguous)', () => {
        expect(hasReferralNudge(nudgeTx('OFFRAMP', 'bank_claim'))).toBe(false)
    })

    // 'bank_request_fulfillment' only ever renders for userRole SENDER (p2p-send.ts).
    test('a bridge-fulfilled request nudges the payer', () => {
        expect(hasReferralNudge(nudgeTx('P2P_REQUEST_FULFILL', 'bank_request_fulfillment'))).toBe(true)
    })

    // A card refund keeps the spend kind on legacy rows but arrives inbound.
    test('a card refund (spend kind, direction receive) gets no nudge', () => {
        expect(hasReferralNudge(nudgeTx('CARD_SPEND_CLEAR', 'receive'))).toBe(false)
    })

    test('an unknown kind gets no nudge', () => {
        expect(hasReferralNudge(nudgeTx('SOME_OTHER_KIND', 'send'))).toBe(false)
    })
})

// gates the clickable counterparty name in BOTH the history row
// (TransactionCard) and the receipt header (TransactionDetailsHeaderCard): any
// non-link transaction whose peer is a real user with a username deep-links to
// that Peanut profile, regardless of the receipt's presentation type.
describe('hasUserProfile', () => {
    const profileTx = (
        transactionCardType: string | undefined,
        opts?: {
            userName?: string
            nameKey?: TransactionDetails['nameKey']
            isLinkTransaction?: boolean
            isPeerActuallyUser?: boolean
        }
    ): TransactionDetails =>
        ({
            userName: opts?.userName ?? 'natalia',
            nameKey: opts?.nameKey,
            isPeerActuallyUser: opts?.isPeerActuallyUser ?? true,
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                transactionCardType,
                isLinkTransaction: opts?.isLinkTransaction ?? false,
            },
        }) as unknown as TransactionDetails

    test.each(['send', 'request', 'receive', 'bank_request_fulfillment', 'add'])(
        'a %s to a real username has a profile',
        (type) => {
            expect(hasUserProfile(profileTx(type))).toBe(true)
        }
    )

    test.each(['pay', 'card_pay', 'withdraw', 'bank_withdraw', 'claim_external'])(
        'a non-user %s counterparty has no peer profile',
        (type) => {
            expect(hasUserProfile(profileTx(type, { isPeerActuallyUser: false }))).toBe(false)
        }
    )

    test('an unknown presentation type does not hide a real user profile', () => {
        expect(hasUserProfile(profileTx(undefined))).toBe(true)
    })

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

    test('a generated fallback label has no profile even if the peer flag is wrong', () => {
        expect(
            hasUserProfile(
                profileTx('bank_request_fulfillment', {
                    userName: 'Recipient',
                    nameKey: 'name.recipient',
                    isPeerActuallyUser: true,
                })
            )
        ).toBe(false)
    })

    // A non-user peer (raw address, bank account, or a system copy string like
    // 'Request'/reaper-fail text) is authoritatively flagged by the transformer.
    test('a non-user peer has no profile even for a send/request/receive', () => {
        expect(hasUserProfile(profileTx('send', { isPeerActuallyUser: false }))).toBe(false)
    })

    // A usernameless Peanut user surfaces their userId (UUID) in `userName`;
    // there is no /<uuid> profile page, so it must not be a nav target.
    test('a usernameless user (UUID userId fallback) has no profile', () => {
        expect(hasUserProfile(profileTx('send', { userName: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }))).toBe(false)
    })

    test.each(['send', 'request', 'receive'])('a %s user avatar links to the profile', (type) => {
        expect(hasUserProfileAvatar(profileTx(type))).toBe(true)
    })

    test('a bank-request flag stays inert even when the counterparty name has a profile', () => {
        expect(hasUserProfile(profileTx('bank_request_fulfillment'))).toBe(true)
        expect(hasUserProfileAvatar(profileTx('bank_request_fulfillment'))).toBe(false)
    })

    test('a non-user avatar never links to a profile', () => {
        expect(hasUserProfileAvatar(profileTx('send', { isPeerActuallyUser: false }))).toBe(false)
    })
})
