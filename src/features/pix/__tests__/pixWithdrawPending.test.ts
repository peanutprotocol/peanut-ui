/** @jest-environment jsdom */
import {
    canKeepTransferMark,
    clearTransferPending,
    markTransferPending,
    parsePendingTransfer,
    PENDING_TRANSFER_KEY,
    type PendingTransfer,
} from '../pixWithdrawPending'

const pending = {
    userId: 'u1',
    priceLockCode: 'lock-1',
    display: { amountBrl: '503.00' },
    submittedAt: Date.parse('2026-11-10T12:00:00Z'),
    settleBy: Date.parse('2026-11-10T12:13:00Z'),
} as unknown as PendingTransfer

describe('the pending-transfer mark', () => {
    afterEach(() => {
        jest.restoreAllMocks()
        window.localStorage.clear()
    })

    it('is written for one account, read back as written, until it is cleared', () => {
        expect(markTransferPending(pending)).toBe(true)
        expect(parsePendingTransfer(window.localStorage.getItem(PENDING_TRANSFER_KEY))).toEqual(pending)
        clearTransferPending()
        expect(window.localStorage.getItem(PENDING_TRANSFER_KEY)).toBeNull()
    })

    it('reads a missing, broken or account-less mark as none', () => {
        expect(parsePendingTransfer(null)).toBeNull()
        expect(parsePendingTransfer('{not json')).toBeNull()
        expect(parsePendingTransfer(JSON.stringify({ ...pending, userId: undefined }))).toBeNull()
    })

    // quota, private mode or blocked storage: the guard cannot hold, and the caller must not submit
    it('says so when this browser cannot keep it', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError')
        })
        expect(canKeepTransferMark()).toBe(false)
        expect(markTransferPending(pending)).toBe(false)
        expect(window.localStorage.getItem(PENDING_TRANSFER_KEY)).toBeNull()
    })

    it('can be kept where storage works, and the probe leaves nothing behind', () => {
        expect(canKeepTransferMark()).toBe(true)
        expect(window.localStorage.length).toBe(0)
    })
})
