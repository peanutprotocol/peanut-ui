import { receiptKindForCharge, receiptStatusForCharge } from '../charge-receipt.utils'

describe('receiptKindForCharge', () => {
    // a P2P_SEND made before 2026-04 reads as DIRECT_SEND, and the inverse 404s
    it('uses the kind the API states, over the type it was folded into', () => {
        expect(receiptKindForCharge({ transactionType: 'DIRECT_SEND', intentKind: 'P2P_SEND' })).toBe('P2P_SEND')
    })

    it.each([
        ['DIRECT_SEND', 'DIRECT_TRANSFER'],
        ['REQUEST', 'P2P_REQUEST_FULFILL'],
        ['WITHDRAW', 'CRYPTO_WITHDRAW'],
        ['DEPOSIT', 'CRYPTO_DEPOSIT'],
        ['SEND_LINK', 'SEND_LINK'],
    ])('falls back to the table on an API without intentKind: %s', (transactionType, kind) => {
        expect(receiptKindForCharge({ transactionType })).toBe(kind)
    })

    it.each([['SOMETHING_NEW'], [undefined], [null]])('never returns undefined for %p', (transactionType) => {
        expect(receiptKindForCharge({ transactionType })).toBe('DIRECT_TRANSFER')
    })
})

// TASK-23856: the external-wallet receipt said "completed" whatever the charge said
describe('receiptStatusForCharge', () => {
    it.each([
        ['COMPLETED', 'completed'],
        ['PROCESSING', 'processing'],
        ['PENDING', 'pending'],
        ['FAILED', 'failed'],
        ['CANCELLED', 'cancelled'],
    ])('reads %s as %s', (status, expected) => {
        expect(receiptStatusForCharge({ status })).toBe(expected)
    })

    it('says nothing when the API sends no status, or one this build does not know', () => {
        expect(receiptStatusForCharge({})).toBeUndefined()
        expect(receiptStatusForCharge(null)).toBeUndefined()
        expect(receiptStatusForCharge({ status: 'SOMETHING_NEW' })).toBeUndefined()
    })
})
