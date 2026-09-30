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
        expect(receiptPdfVersion({ ...base, completedAt: '2026-09-30T10:00:00Z' })).not.toBe(pending)
        expect(receiptPdfVersion({ ...base, txHash: '0xabc' })).not.toBe(pending)
        const withRate = (rate: string) =>
            ({ ...base, extraDataForDrawer: { receipt: { exchange_rate: rate } } }) as unknown as TransactionDetails
        expect(receiptPdfVersion(withRate('1400'))).not.toBe(receiptPdfVersion(withRate('1420')))
    })

    test('is an opaque digest, never the receipt details themselves', () => {
        const version = receiptPdfVersion({ ...base, amount: 1234.56, txHash: '0xdeadbeef' })
        expect(version).toMatch(/^[0-9a-f]{16}$/)
        expect(version).not.toContain('1234')
    })

    test('is stable for an unchanged receipt, bigint amounts included', () => {
        expect(receiptPdfVersion({ ...base })).toBe(receiptPdfVersion(base))
        expect(receiptPdfVersion({ ...base, amount: BigInt(10) })).toBe(
            receiptPdfVersion({ ...base, amount: BigInt(10) })
        )
    })
})
