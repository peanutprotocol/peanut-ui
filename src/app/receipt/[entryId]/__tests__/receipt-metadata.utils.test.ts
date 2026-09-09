/**
 * Chip review (PR #3017): completeHistoryEntry blanks a pending Bridge
 * OFFRAMP's `currency.amount` to '' (history.utils.ts) rather than leaving
 * the mirrored crypto-leg figure in place. `generateReceiptTitle` reads that
 * same field for the receipt page's <title> / link-preview text — without a
 * validity guard, `formatAmount('')` returns '0', so a pending ARS/BRL/EUR
 * withdrawal's title read "Receipt - Withdrawal of ARS 0" while the payout
 * was still in flight.
 */
import { generateReceiptTitle } from '../receipt-metadata.utils'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

const baseTx = {
    direction: 'withdraw',
    amount: 30,
    userName: undefined,
    status: 'pending',
    tokenSymbol: 'USDC',
} as unknown as TransactionDetails

describe('generateReceiptTitle', () => {
    // tokenSymbol=USDC is realistic for a Peanut wallet OFFRAMP (the balance
    // side is always USDC) — a stablecoin, so falling out of the currency
    // branch lands on the plain `$amount` branch, not a token-amount one.
    it('falls back to $amount when currency.amount is blanked (pending OFFRAMP)', () => {
        const tx = { ...baseTx, currency: { amount: '', code: 'ARS' } } as TransactionDetails
        expect(generateReceiptTitle(tx)).toBe('Receipt - Withdrawal of $30.00')
    })

    it('falls back to $amount when currency.amount is missing entirely', () => {
        const tx = { ...baseTx, currency: { code: 'ARS' } as any } as TransactionDetails // deliberately missing `amount`
        expect(generateReceiptTitle(tx)).toBe('Receipt - Withdrawal of $30.00')
    })

    it('uses the real converted local amount once it is valid (completed OFFRAMP)', () => {
        const tx = { ...baseTx, status: 'completed', currency: { amount: '30000', code: 'ARS' } } as TransactionDetails
        expect(generateReceiptTitle(tx)).toBe('Receipt - Withdrawal of ARS 30000')
    })
})
