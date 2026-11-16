// One conversion, one rule, for the details card and the PDF.
import {
    isSettledConversion,
    receiptConversionLine,
    receiptConvertedAmount,
    receiptExchangeRate,
    receiptProviderFee,
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
        // a mixed-case symbol keeps its real spelling; old lower-case records do not
        expect(receiptConvertedAmount({ tokenSymbol: 'USDe', tokenAmount: '10.086357' })).toBe('10.086357 USDe')
        expect(receiptConvertedAmount({ tokenSymbol: 'EURC', tokenAmount: '8.900320' })).toBe('8.900320 EURC')
    })

    it('is no conversion for USD or a USD stablecoin', () => {
        expect(receiptConvertedAmount({ currency: { code: 'USD', amount: '5' } })).toBeUndefined()
        expect(receiptConvertedAmount({ tokenSymbol: 'USDC', tokenAmount: '5' })).toBeUndefined()
    })
})

describe('receiptProviderFee', () => {
    const avenia = (drawer: Record<string, unknown>) =>
        eurDeposit({
            currency: { code: 'BRL', amount: '20.00' },
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.RECIPIENT,
                kind: 'ONRAMP',
                ...drawer,
            },
        })

    it('prints the flat fee in reais beside the rate', () => {
        const tx = avenia({ receipt: { exchange_rate: '5.796567' }, providerFeeBrl: '0.75' })
        expect(receiptExchangeRate(tx)).toBe('1 USD = BRL 5.80')
        expect(receiptProviderFee(tx)).toBe('R$0.75')
    })

    it('prints no fee without the rate, nor a rate-only entry’s fee', () => {
        expect(receiptProviderFee(avenia({ providerFeeBrl: '0.75' }))).toBeUndefined()
        expect(receiptProviderFee(avenia({ receipt: { exchange_rate: '5.796567' } }))).toBeUndefined()
    })
})

describe('receiptExchangeRate', () => {
    it('prints the rate for a fiat-rail entry', () => {
        expect(receiptExchangeRate(eurDeposit())).toBe('1 USD = EUR 0.88')
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
        ).toBe('33.25 USD → ARS 30,000')
    })

    // A Pix payment of 1.127608 USDC: the headline rounds half-up to "-$1.13",
    // so the conversion row must say 1.13 too, never a truncated 1.12.
    it('rounds the balance side half-up, like the headline', () => {
        expect(
            receiptConversionLine(eurDeposit({ amount: -1.127608, currency: { code: 'BRL', amount: '6.00' } }), '-')
        ).toBe('1.13 USD → BRL 6')
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
