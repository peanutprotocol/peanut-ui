import { friendlyDeclineReason } from '../cardDeclineReason'

describe('friendlyDeclineReason', () => {
    describe('category takes precedence over raw code', () => {
        test('limit_too_low overrides INSUFFICIENT_FUNDS', () => {
            // The Rain bug case: raw reason says broke, but the synthetic
            // category says the limit blocked the spend. We want the
            // actionable "raise your limit" copy.
            expect(friendlyDeclineReason('INSUFFICIENT_FUNDS', 'limit_too_low')).toBe(
                'Card limit reached — increase your limit'
            )
        })

        test('insufficient_balance category matches direct copy', () => {
            expect(friendlyDeclineReason('INSUFFICIENT_FUNDS', 'insufficient_balance')).toBe('Insufficient balance')
        })

        test('"other" category falls through to raw-code mapping', () => {
            // 'other' intentionally has no CATEGORY_COPY entry so non-financial
            // declines still render their specific friendly text.
            expect(friendlyDeclineReason('blocked_merchant', 'other')).toBe("This merchant isn't supported")
        })

        test('"other" + no code → generic fallback', () => {
            expect(friendlyDeclineReason(null, 'other')).toBe('Transaction declined')
        })
    })

    describe('raw-code mapping (no category)', () => {
        test('SCREAMING_CASE Rain code', () => {
            expect(friendlyDeclineReason('INSUFFICIENT_FUNDS')).toBe('Insufficient balance')
        })

        test('snake_case Rain code', () => {
            expect(friendlyDeclineReason('card_spending_limit_exceeded')).toBe('Spending limit reached')
        })

        test('case-insensitive fallback when exact case not in map', () => {
            // The map has BLOCKED_MERCHANT + blocked_merchant; "Blocked_Merchant"
            // would only hit via toLowerCase().
            expect(friendlyDeclineReason('Blocked_Merchant')).toBe("This merchant isn't supported")
        })

        test('unknown code → generic fallback', () => {
            expect(friendlyDeclineReason('SOME_UNMAPPED_REASON')).toBe('Transaction declined')
        })

        test('null/undefined code → generic fallback', () => {
            expect(friendlyDeclineReason(null)).toBe('Transaction declined')
            expect(friendlyDeclineReason(undefined)).toBe('Transaction declined')
        })
    })

    describe('legacy intents (category omitted)', () => {
        test('honors raw code when category is undefined', () => {
            // Older declines that pre-date the categorization land here.
            expect(friendlyDeclineReason('INSUFFICIENT_FUNDS')).toBe('Insufficient balance')
        })

        test('honors raw code when category is null', () => {
            expect(friendlyDeclineReason('card_locked', null)).toBe('Your card is locked')
        })
    })

    describe('Rain prose strings normalize correctly', () => {
        // Real example from 2026-05-11 staging webhook (Adidas decline).
        // Rain emits human-readable prose, not just snake_case codes.
        test('"account credit limit exceeded" → insufficient balance copy', () => {
            expect(friendlyDeclineReason('account credit limit exceeded')).toBe('Insufficient balance')
        })

        test('"card spending limit exceeded" → spending-limit copy', () => {
            expect(friendlyDeclineReason('card spending limit exceeded')).toBe('Spending limit reached')
        })

        test('mixed-case prose normalized too', () => {
            expect(friendlyDeclineReason('Account Credit Limit Exceeded')).toBe('Insufficient balance')
        })

        test('snake_case + SCREAMING_CASE still hit the same friendly copy', () => {
            // Pin the normalization: all three shapes for the same code
            // must produce the same output.
            expect(friendlyDeclineReason('insufficient_funds')).toBe('Insufficient balance')
            expect(friendlyDeclineReason('INSUFFICIENT_FUNDS')).toBe('Insufficient balance')
            expect(friendlyDeclineReason('Insufficient Funds')).toBe('Insufficient balance')
        })

        test('whitespace and punctuation tolerated', () => {
            expect(friendlyDeclineReason('  insufficient   funds  ')).toBe('Insufficient balance')
            expect(friendlyDeclineReason('insufficient-funds')).toBe('Insufficient balance')
        })
    })
})
