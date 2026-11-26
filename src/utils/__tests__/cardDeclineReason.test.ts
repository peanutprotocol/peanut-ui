// The module is copy-free — it resolves Rain's decline reasons to a display
// code that CardPaymentRows maps to `transaction.decline.*` copy. These tests
// pin the resolution; the English wording is pinned by the catalog itself.
import { declineReasonCode } from '../cardDeclineReason'

describe('declineReasonCode', () => {
    describe('category takes precedence over raw code', () => {
        test('limit_too_low overrides INSUFFICIENT_FUNDS', () => {
            // The Rain bug case: raw reason says broke, but the synthetic
            // category says the limit blocked the spend. We want the
            // actionable "raise your limit" copy.
            expect(declineReasonCode('INSUFFICIENT_FUNDS', 'limit_too_low')).toBe('limitTooLow')
        })

        test('insufficient_balance category maps directly', () => {
            expect(declineReasonCode('INSUFFICIENT_FUNDS', 'insufficient_balance')).toBe('insufficientBalance')
        })

        test('"other" category falls through to raw-code mapping', () => {
            // 'other' intentionally has no CATEGORY_CODES entry so non-financial
            // declines still resolve to their specific code.
            expect(declineReasonCode('blocked_merchant', 'other')).toBe('blockedMerchant')
        })

        test('"other" + no code → generic fallback', () => {
            expect(declineReasonCode(null, 'other')).toBe('generic')
        })
    })

    describe('raw-code mapping (no category)', () => {
        test('SCREAMING_CASE Rain code', () => {
            expect(declineReasonCode('INSUFFICIENT_FUNDS')).toBe('insufficientBalance')
        })

        test('snake_case Rain code', () => {
            expect(declineReasonCode('card_spending_limit_exceeded')).toBe('spendingLimitReached')
        })

        test('case-insensitive fallback when exact case not in map', () => {
            // The map has BLOCKED_MERCHANT + blocked_merchant; "Blocked_Merchant"
            // would only hit via toLowerCase().
            expect(declineReasonCode('Blocked_Merchant')).toBe('blockedMerchant')
        })

        test('unknown code → generic fallback', () => {
            expect(declineReasonCode('SOME_UNMAPPED_REASON')).toBe('generic')
        })

        test('null/undefined code → generic fallback', () => {
            expect(declineReasonCode(null)).toBe('generic')
            expect(declineReasonCode(undefined)).toBe('generic')
        })
    })

    describe('legacy intents (category omitted)', () => {
        test('honors raw code when category is undefined', () => {
            // Older declines that pre-date the categorization land here.
            expect(declineReasonCode('INSUFFICIENT_FUNDS')).toBe('insufficientBalance')
        })

        test('honors raw code when category is null', () => {
            expect(declineReasonCode('card_locked', null)).toBe('cardLocked')
        })
    })

    describe('Rain prose strings normalize correctly', () => {
        // Real example from 2026-05-11 staging webhook (Adidas decline).
        // Rain emits human-readable prose, not just snake_case codes.
        test('"account credit limit exceeded" → insufficient balance', () => {
            expect(declineReasonCode('account credit limit exceeded')).toBe('insufficientBalance')
        })

        test('"card spending limit exceeded" → spending limit', () => {
            expect(declineReasonCode('card spending limit exceeded')).toBe('spendingLimitReached')
        })

        test('mixed-case prose normalized too', () => {
            expect(declineReasonCode('Account Credit Limit Exceeded')).toBe('insufficientBalance')
        })

        test('snake_case + SCREAMING_CASE still hit the same code', () => {
            // Pin the normalization: all three shapes for the same code
            // must produce the same output.
            expect(declineReasonCode('insufficient_funds')).toBe('insufficientBalance')
            expect(declineReasonCode('INSUFFICIENT_FUNDS')).toBe('insufficientBalance')
            expect(declineReasonCode('Insufficient Funds')).toBe('insufficientBalance')
        })

        test('whitespace and punctuation tolerated', () => {
            expect(declineReasonCode('  insufficient   funds  ')).toBe('insufficientBalance')
            expect(declineReasonCode('insufficient-funds')).toBe('insufficientBalance')
        })
    })

    // Reason strings and MCCs from prod card declines (TASK-25099, 2026-11).
    describe('merchant and MCC blocks', () => {
        test.each([
            ['blocked mcc', '6540'],
            ['block transaction from high-risk merchant category codes [v3', '4829'],
            ['blocked mcc', '6012'],
            ['blocked mcc', '6011'],
            ['triggers for transactions from mcc 6050 and 6051', '6051'],
        ])('%s at MCC %s → cashLikeMerchant', (reason, mcc) => {
            expect(declineReasonCode(reason, 'other', mcc)).toBe('cashLikeMerchant')
        })

        test.each([
            ['blocked mcc', '5993'],
            ['blocked merchant', '5816'],
            ['block transactions from specified high-risk e-commerce merch', '5818'],
            ['block transaction from high-risk merchant category codes [v3', '5967'],
            ['triggers for transactions from mcc 6050 and 6051', null],
        ])('%s at MCC %s → blockedMerchant', (reason, mcc) => {
            expect(declineReasonCode(reason, 'other', mcc)).toBe('blockedMerchant')
        })

        test('a cash-like MCC without a block reason keeps its own code', () => {
            expect(declineReasonCode('card locked', 'other', '4829')).toBe('cardLocked')
        })

        test('the BE category still wins', () => {
            expect(declineReasonCode('blocked mcc', 'insufficient_balance', '6540')).toBe('insufficientBalance')
        })
    })
})
