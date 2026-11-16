/**
 * A settled Avenia Pix entry carries its rate with the variable fees inside (`receipt.exchange_rate`)
 * and its flat fee in reais (`providerFeeBrl`), both or neither (TASK-24967). The receipt prints the
 * rate and one "Provider fee" row from those two fields, as the list entry sends them.
 */
import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { receiptExchangeRate, receiptProviderFee } from '../receipt-conversion.utils'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

// the owner's R$20 deposit: Avenia's rate 5.728962, fees 0.75 + 0.22 + gas, 3.320931 USDC credited
const deposit = (extraData: Record<string, unknown>): HistoryEntry =>
    ({
        uuid: 'avenia-deposit',
        type: 'TRANSACTION_INTENT',
        timestamp: '2026-11-15T10:00:00.000Z',
        createdAt: '2026-11-15T10:00:00.000Z',
        amount: '3.320931',
        tokenSymbol: 'USDC',
        status: 'COMPLETED',
        userRole: 'RECIPIENT',
        currency: { amount: '20.00', code: 'BRL' },
        extraData: { kind: 'ONRAMP', provider: 'AVENIA', usdAmount: '3.320931', ...extraData },
    }) as unknown as HistoryEntry

describe('a settled Avenia entry’s rate and provider fee on the receipt', () => {
    it('carries both fields from the entry, and they reconcile with its amounts', () => {
        const { transactionDetails } = mapTransactionDataForDrawer(
            deposit({ receipt: { exchange_rate: '5.796567' }, providerFeeBrl: '0.75' })
        )
        expect(receiptExchangeRate(transactionDetails)).toBe('1 USD = BRL 5.80')
        expect(receiptProviderFee(transactionDetails)).toBe('R$0.75')
        // (20.00 − 0.75) ÷ 5.796567 = 3.32 USD credited
        expect(((20 - 0.75) / 5.796567).toFixed(2)).toBe(Number(transactionDetails.amount).toFixed(2))
    })

    it('drops a fee the entry sends without its rate', () => {
        const { transactionDetails } = mapTransactionDataForDrawer(deposit({ providerFeeBrl: '0.75' }))
        expect(transactionDetails.extraDataForDrawer?.providerFeeBrl).toBeUndefined()
        expect(receiptProviderFee(transactionDetails)).toBeUndefined()
    })

    it('shows neither row for an entry that sends neither', () => {
        const { transactionDetails } = mapTransactionDataForDrawer(deposit({}))
        expect(receiptExchangeRate(transactionDetails)).toBeUndefined()
        expect(receiptProviderFee(transactionDetails)).toBeUndefined()
    })
})
