import {
    isChargeAwaitingBooking,
    readChargeUntilFinal,
    receiptKindForCharge,
    receiptStatusForCharge,
} from '../charge-receipt.utils'

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

// TASK-23856: Rhino says "completed" before the API books the payment, so the
// charge is read until it is final.
describe('readChargeUntilFinal', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    const reads = (...statuses: (string | Error | undefined)[]) => {
        const read = jest.fn()
        for (const status of statuses) {
            if (status instanceof Error) read.mockRejectedValueOnce(status)
            else read.mockResolvedValueOnce({ status })
        }
        return read
    }

    it('waits through PROCESSING reads until the charge completes', async () => {
        const read = reads('PENDING', 'PROCESSING', 'COMPLETED')
        const result = readChargeUntilFinal(read)
        await jest.advanceTimersByTimeAsync(6_000)
        await expect(result).resolves.toEqual({ charge: { status: 'COMPLETED' }, outcome: 'completed' })
        expect(read).toHaveBeenCalledTimes(3)
    })

    it.each(['FAILED', 'CANCELLED'])('stops on %s', async (status) => {
        const result = readChargeUntilFinal(reads('PROCESSING', status))
        await jest.advanceTimersByTimeAsync(3_000)
        await expect(result).resolves.toEqual({ charge: { status }, outcome: 'failed' })
    })

    it('gives up after the timeout with the last read', async () => {
        const read = jest.fn().mockResolvedValue({ status: 'PROCESSING' })
        const result = readChargeUntilFinal(read)
        await jest.advanceTimersByTimeAsync(60_000)
        await expect(result).resolves.toEqual({ charge: { status: 'PROCESSING' }, outcome: 'timeout' })
        // one read at once, then one every 3 s through the minute
        expect(read).toHaveBeenCalledTimes(21)
    })

    it('retries a failed read', async () => {
        const result = readChargeUntilFinal(reads(new Error('offline'), 'COMPLETED'))
        await jest.advanceTimersByTimeAsync(3_000)
        await expect(result).resolves.toMatchObject({ outcome: 'completed' })
    })

    it('does not wait on an API that sends no charge status', async () => {
        const read = reads(undefined)
        await expect(readChargeUntilFinal(read)).resolves.toMatchObject({ outcome: 'unknown' })
        expect(read).toHaveBeenCalledTimes(1)
    })

    // A top-up on a charge that completed short: the charge already reads
    // COMPLETED, so only a moved settled amount says the new transfer booked.
    it('on a top-up, a COMPLETED read whose settled amount has not moved is not final yet', async () => {
        const read = jest
            .fn()
            .mockResolvedValueOnce({ status: 'COMPLETED', settledAmount: '33' })
            .mockResolvedValueOnce({ status: 'COMPLETED', settledAmount: '33' })
            .mockResolvedValueOnce({ status: 'COMPLETED', settledAmount: '58.51' })
        const result = readChargeUntilFinal(read, { settledBefore: '33' })
        await jest.advanceTimersByTimeAsync(6_000)
        await expect(result).resolves.toEqual({
            charge: { status: 'COMPLETED', settledAmount: '58.51' },
            outcome: 'completed',
        })
        expect(read).toHaveBeenCalledTimes(3)
    })

    it('on a top-up the API has not booked by the deadline, gives up with the old read', async () => {
        const read = jest.fn().mockResolvedValue({ status: 'COMPLETED', settledAmount: '33' })
        const result = readChargeUntilFinal(read, { settledBefore: '33' })
        await jest.advanceTimersByTimeAsync(60_000)
        await expect(result).resolves.toEqual({
            charge: { status: 'COMPLETED', settledAmount: '33' },
            outcome: 'timeout',
        })
    })
})

describe('isChargeAwaitingBooking', () => {
    it.each(['PENDING', 'PROCESSING', 'AWAITING_SETTLEMENT'])('%s is still booking', (status) => {
        expect(isChargeAwaitingBooking({ status })).toBe(true)
    })

    it.each(['COMPLETED', 'FAILED', 'CANCELLED'])('%s is final', (status) => {
        expect(isChargeAwaitingBooking({ status })).toBe(false)
    })

    // an API without the charge status cannot say the payment booked, so the
    // success screen must not claim an amount
    it('treats a missing status as still booking', () => {
        expect(isChargeAwaitingBooking({})).toBe(true)
        expect(isChargeAwaitingBooking(null)).toBe(true)
    })
})
