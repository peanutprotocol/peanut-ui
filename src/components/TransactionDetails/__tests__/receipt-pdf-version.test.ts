import { receiptPdfVersion } from '../receipt-pdf-link.utils'
import type { TransactionDetails } from '../transactionTransformer'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(), openExternalUrl: jest.fn() }))

const base = { id: 'entry', status: 'pending', amount: 10 } as unknown as TransactionDetails

describe('receiptPdfVersion', () => {
    test('changes when the status or amount changes', () => {
        const pending = receiptPdfVersion(base)
        expect(receiptPdfVersion({ ...base, status: 'completed' } as TransactionDetails)).not.toBe(pending)
        expect(receiptPdfVersion({ ...base, amount: 12 })).not.toBe(pending)
        expect(receiptPdfVersion({ ...base, currency: { amount: '9', code: 'ARS' } })).not.toBe(pending)
    })

    test('is stable for an unchanged receipt, bigint amounts included', () => {
        expect(receiptPdfVersion({ ...base })).toBe(receiptPdfVersion(base))
        expect(receiptPdfVersion({ ...base, amount: BigInt(10) })).toBe(
            receiptPdfVersion({ ...base, amount: BigInt(10) })
        )
    })
})
