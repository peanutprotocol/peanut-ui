// One conversion, one rule, for the details card and the PDF.
import {
    isSettledConversion,
    receiptConversionLine,
    receiptConvertedAmount,
    receiptExchangeRate,
} from '../receipt-conversion.utils'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

const eurDeposit = (overrides: Record<string, unknown> = {}): TransactionDetails =>
    ({
        id: 'dep-1',
        direction: 'bank_deposit',
        status: 'completed',
        amount: 24.32,
        tokenSymbol: 'USDC',
        currency: { code: 'EUR', amount: '21.33' },
        extraDataForDrawer: {
            originalType: 'TRANSACTION_INTENT',
            originalUserRole: EHistoryUserRole.RECIPIENT,
            kind: 'ONRAMP',
            receipt: { exchange_rate: '0.8769' },
        },
        ...overrides,
    }) as unknown as TransactionDetails

describe('receiptConvertedAmount', () => {
    it('prefers the local fiat side', () => {
        expect(receiptConvertedAmount(eurDeposit())).toBe('EUR 21.33')
    })

    it('falls back to a non-stable destination token with full decimals', () => {
        expect(receiptConvertedAmount({ tokenSymbol: 'eth', tokenAmount: '0.000416666' })).toBe('0.000416666 ETH')
    })

    it('is no conversion for USD or a USD stablecoin', () => {
        expect(receiptConvertedAmount({ currency: { code: 'USD', amount: '5' } })).toBeUndefined()
        expect(receiptConvertedAmount({ tokenSymbol: 'USDC', tokenAmount: '5' })).toBeUndefined()
    })
})

describe('receiptExchangeRate', () => {
    it('prints the rate for a fiat-rail entry', () => {
        expect(receiptExchangeRate(eurDeposit())).toBe('1 USD = EUR 0.8769')
    })

    it('prints nothing on a cancelled entry or without a rate', () => {
        expect(receiptExchangeRate(eurDeposit({ status: 'cancelled' }))).toBeUndefined()
        expect(
            receiptExchangeRate(
                eurDeposit({
                    extraDataForDrawer: { originalType: 'TRANSACTION_INTENT', kind: 'ONRAMP' },
                })
            )
        ).toBeUndefined()
    })

    it('prints nothing for a kind that crosses no fiat rail', () => {
        expect(
            receiptExchangeRate(
                eurDeposit({
                    extraDataForDrawer: {
                        originalType: 'TRANSACTION_INTENT',
                        kind: 'DIRECT_TRANSFER',
                        receipt: { exchange_rate: '0.8769' },
                    },
                })
            )
        ).toBeUndefined()
    })
})

describe('receiptConversionLine', () => {
    it('reads fiat → balance for money coming in', () => {
        expect(receiptConversionLine(eurDeposit(), '+')).toBe('EUR 21.33 → 24.32 USD')
    })

    it('reads balance → fiat for money going out', () => {
        expect(
            receiptConversionLine(eurDeposit({ amount: -33.25, currency: { code: 'ARS', amount: '30000' } }), '-')
        ).toBe('33.25 USD → ARS 30,000.00')
    })

    it('is nothing when there is no conversion', () => {
        expect(receiptConversionLine(eurDeposit({ currency: { code: 'USD', amount: '5' } }), '+')).toBeUndefined()
    })
})

describe('isSettledConversion', () => {
    it('is settled once completed, refunded, or returned after settling', () => {
        expect(isSettledConversion(eurDeposit())).toBe(true)
        expect(isSettledConversion(eurDeposit({ status: 'refunded' }))).toBe(true)
        expect(
            isSettledConversion(
                eurDeposit({
                    status: 'failed',
                    extraDataForDrawer: { originalType: 'TRANSACTION_INTENT', wasReturned: true },
                })
            )
        ).toBe(true)
    })

    it('is an estimate while pending, or when it failed before settling', () => {
        expect(isSettledConversion(eurDeposit({ status: 'pending' }))).toBe(false)
        expect(isSettledConversion(eurDeposit({ status: 'failed' }))).toBe(false)
    })
})
