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
import { getAccountCopyValue, getBankAccountLabel } from '../transaction-details.utils'
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
    test("Tron address with a digit 3rd char (wire type 'address') displays VERBATIM, not IBAN-chunked", () => {
        expect(maskAccountIdentifier(TRON_ADDR_DIGIT, 'address')).toBe(TRON_ADDR_DIGIT)
    })

    test("Solana address (wire type 'address') displays VERBATIM", () => {
        expect(maskAccountIdentifier(SOLANA_ADDR, 'address')).toBe(SOLANA_ADDR)
    })

    test('IBAN rail still masks to last-4 groups (no regression)', () => {
        expect(maskAccountIdentifier('DE89370400440532013000', 'IBAN')).toBe('**** **** **** 3000')
    })
})

describe('getBankAccountLabel', () => {
    test("crypto destinations (wire type 'address') label as Address, not Account Number", () => {
        expect(getBankAccountLabel('address')).toBe('Address')
        expect(getBankAccountLabel('evm-address')).toBe('Address')
    })
    test('bank rails unchanged', () => {
        expect(getBankAccountLabel('BANK_IBAN')).toBe('IBAN')
        expect(getBankAccountLabel('BANK_CLABE')).toBe('CLABE')
        expect(getBankAccountLabel('us')).toBe('Account Number')
    })
})
