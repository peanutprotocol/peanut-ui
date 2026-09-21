/**
 * Receipt account-row helpers — pinned after the 2026-07-23 Tron QA finding:
 * the account-details row runs the destination through `formatIban`, which
 * treats any string starting with two letters as an IBAN (uppercase + chunk
 * by 4). Every Tron address starts with 'T…' and base58 is case-SENSITIVE,
 * so both the copied value AND (for addresses whose 3rd char is a digit) the
 * displayed value came out corrupted.
 *
 * CRITICAL: these tests feed the REAL wire `type` values the BE serializes
 * for a CRYPTO_WITHDRAW — `'address'` (history `mapGenericIntent`, sender
 * viewer), `'evm-address'`, `'peanut-wallet'` — NOT the Prisma `AccountType`
 * enum (`WALLET_EXTERNAL`), which never reaches the FE. Each case below fails
 * on the pre-fix code (where `'address'` fell through to `formatIban`).
 */
import {
    getAccountCopyValue,
    bankAccountLabelKey,
    receiptHeadlineAmount,
    receiptIssuedAt,
    showsReceiptReferenceRow,
} from '../transaction-details.utils'
import { isCryptoAddressType, maskAccountIdentifier } from '@/utils/account-mask.utils'

// 3rd char is a LETTER (G) — dodges the /^[a-zA-Z]{2}\d/ display heuristic.
const TRON_ADDR = 'THGYiMEYtM5nedRKyC3PyowedCMemBh4GJ'
// 3rd char is a DIGIT (9) — MATCHES the display heuristic; corrupted on
// display too by the pre-fix plain-branch formatIban.
const TRON_ADDR_DIGIT = 'TN9RRaXkCFtTXRso2GdTZxSxxwufzxLQPP'
const SOLANA_ADDR = '6PqX5bvjQqoGYLre1MExbw8H3Y6WEr7rjhKDCQU9iM6b'

describe('isCryptoAddressType — keyed to the real wire vocabulary', () => {
    test.each(['address', 'evm-address', 'peanut-wallet', 'Address', 'EVM-ADDRESS'])('%s → true', (t) => {
        expect(isCryptoAddressType(t)).toBe(true)
    })
    test.each(['iban', 'BANK_IBAN', 'us', 'clabe', 'pix', 'merchant', '', null, undefined])('%s → false', (t) => {
        expect(isCryptoAddressType(t)).toBe(false)
    })
})

describe('getAccountCopyValue — copy path', () => {
    test("Tron destination (wire type 'address') copies VERBATIM", () => {
        expect(getAccountCopyValue(TRON_ADDR, 'address')).toBe(TRON_ADDR)
    })

    test("Solana destination (wire type 'address') copies VERBATIM", () => {
        expect(getAccountCopyValue(SOLANA_ADDR, 'address')).toBe(SOLANA_ADDR)
    })

    test("EVM destination (wire type 'evm-address') copies VERBATIM", () => {
        const evm = '0xCfB0eA7Ba06EffC1534f232736c31F69aD03F91b'
        expect(getAccountCopyValue(evm, 'evm-address')).toBe(evm)
    })

    test('IBAN rail keeps the formatted copy shape (uppercased, chunked by 4)', () => {
        expect(getAccountCopyValue('de89370400440532013000', 'iban')).toBe('DE89 3704 0044 0532 0130 00')
    })

    test('US account number (digits) passes through untouched', () => {
        expect(getAccountCopyValue('123456789', 'us')).toBe('123456789')
    })
})

describe('maskAccountIdentifier — display path', () => {
    // Shortened (start...end), never IBAN-chunked — the full 34/44-char
    // address is one unbreakable token that overflows the receipt card on
    // mobile (Crisp session_779df6b2, TASK-20889). Copy stays verbatim —
    // see the getAccountCopyValue suite above.
    test("Tron address with a digit 3rd char (wire type 'address') displays shortened, not IBAN-chunked", () => {
        expect(maskAccountIdentifier(TRON_ADDR_DIGIT, 'address')).toBe('TN9RRa...zxLQPP')
    })

    test("Solana address (wire type 'address') displays shortened", () => {
        expect(maskAccountIdentifier(SOLANA_ADDR, 'address')).toBe('6PqX5b...U9iM6b')
    })

    test("EVM address (wire type 'evm-address') displays shortened", () => {
        expect(maskAccountIdentifier('0xCfB0eA7Ba06EffC1534f232736c31F69aD03F91b', 'evm-address')).toBe(
            '0xCfB0...03F91b'
        )
    })

    test('IBAN rail still masks to last-4 groups (no regression)', () => {
        expect(maskAccountIdentifier('DE89370400440532013000', 'IBAN')).toBe('**** **** **** 3000')
    })
})

describe('bankAccountLabelKey', () => {
    test("crypto destinations (wire type 'address') map to the 'address' key, not 'accountNumber'", () => {
        expect(bankAccountLabelKey('address')).toBe('address')
        expect(bankAccountLabelKey('evm-address')).toBe('address')
    })
    test('bank rails map to their scheme key', () => {
        expect(bankAccountLabelKey('BANK_IBAN')).toBe('iban')
        expect(bankAccountLabelKey('BANK_CLABE')).toBe('clabe')
        expect(bankAccountLabelKey('us')).toBe('accountNumber')
    })
})

describe('receiptIssuedAt', () => {
    const base = {
        date: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
        completedAt: '2026-08-02T12:00:00.000Z',
        claimedAt: '2026-08-03T09:00:00.000Z',
        cancelledDate: '2026-08-04T15:00:00.000Z',
    }

    it('completed receipts date from the claim/settlement', () => {
        expect(receiptIssuedAt({ ...base, status: 'completed' })?.toISOString()).toBe(base.claimedAt)
        expect(receiptIssuedAt({ ...base, status: 'completed', claimedAt: undefined })?.toISOString()).toBe(
            base.completedAt
        )
    })

    it('cancelled and closed receipts date from the cancellation', () => {
        expect(receiptIssuedAt({ ...base, status: 'cancelled' })?.toISOString()).toBe(base.cancelledDate)
        expect(receiptIssuedAt({ ...base, status: 'closed' })?.toISOString()).toBe(base.cancelledDate)
    })

    it('refunded receipts date from the refund (the display date)', () => {
        expect(receiptIssuedAt({ ...base, status: 'refunded' })?.toISOString()).toBe(base.date)
    })

    it('pending receipts date from creation', () => {
        expect(receiptIssuedAt({ ...base, status: 'pending' })?.toISOString()).toBe(base.createdAt)
    })
})

/**
 * The receipt screen and the PDF used to answer "how much" differently: a
 * $100 pot that collected $40 printed $100.00 on one and $40.00 on the other,
 * and the PDF dropped the sign so a refund read like a spend.
 */
describe('receiptHeadlineAmount', () => {
    it('leads a request pot with what it collected, not with its goal', () => {
        const headline = receiptHeadlineAmount({ isRequestPotLink: true, totalAmountCollected: 40 }, 100, '+')

        expect(headline).toEqual({ amount: 40, sign: '', isCollectedTotal: true })
    })

    it('leads a goal-less pot with its collected total', () => {
        const headline = receiptHeadlineAmount({ isRequestPotLink: true, totalAmountCollected: 47.25 }, 0, '')

        expect(headline.amount).toBe(47.25)
    })

    it('keeps the direction sign on everything that is not a pot', () => {
        expect(receiptHeadlineAmount({}, 12.5, '-')).toEqual({ amount: 12.5, sign: '-', isCollectedTotal: false })
        expect(receiptHeadlineAmount({}, 12.5, '+').sign).toBe('+')
    })

    it('reads an unusable amount as zero rather than printing NaN', () => {
        expect(receiptHeadlineAmount({ isRequestPotLink: true, totalAmountCollected: null }, 0, '').amount).toBe(0)
        expect(receiptHeadlineAmount({}, Number.NaN, '-').amount).toBe(0)
    })
})

/**
 * The receipt's document-id row. It prints the history-entry id, which on a
 * bank rail is the transfer id and on a crypto entry is the transaction hash
 * — both already printed one row above under their own label. The row used to
 * repeat them, so a real Bridge withdrawal showed the same value twice.
 */
describe('showsReceiptReferenceRow', () => {
    it('drops out on a bank withdrawal, where Transfer ID already prints the id', () => {
        expect(
            showsReceiptReferenceRow({
                id: '11111111-2222-3333-4444-555555555555',
                direction: 'bank_withdraw',
                status: 'completed',
            })
        ).toBe(false)
    })

    it('drops out on a bank claim for the same reason', () => {
        expect(showsReceiptReferenceRow({ id: 'abc-def', direction: 'bank_claim', status: 'completed' })).toBe(false)
    })

    it('shows on a cancelled bank withdrawal, where the Transfer ID row is hidden', () => {
        expect(showsReceiptReferenceRow({ id: 'abc-def', direction: 'bank_withdraw', status: 'cancelled' })).toBe(true)
    })

    it('drops out when the id IS the hash the Transaction ID row prints', () => {
        expect(
            showsReceiptReferenceRow({
                id: '0x8b5cdd00ab',
                txHash: '0x8b5cdd00ab',
                direction: 'crypto_deposit',
                status: 'completed',
            })
        ).toBe(false)
    })

    it('compares the id and the hash without case, because only the copy is case-sensitive', () => {
        expect(
            showsReceiptReferenceRow({
                id: '0X8B5C00AB',
                txHash: '0x8b5c00ab',
                direction: 'crypto_deposit',
                status: 'completed',
            })
        ).toBe(false)
    })

    it('still shows when the id names something no other row carries', () => {
        expect(
            showsReceiptReferenceRow({
                id: '11111111-2222-3333-4444-555555555555',
                txHash: '0x8b5c00ab',
                direction: 'direct_transfer',
                status: 'completed',
            })
        ).toBe(true)
    })

    it('shows nothing when there is no id', () => {
        expect(showsReceiptReferenceRow({ direction: 'direct_transfer', status: 'completed' })).toBe(false)
    })
})
