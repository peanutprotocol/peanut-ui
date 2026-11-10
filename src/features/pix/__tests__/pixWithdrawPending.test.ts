/** @jest-environment jsdom */
import {
    canKeepTransferMark,
    clearTransferPending,
    markTransferPending,
    parsePendingTransfers,
    pendingTransfersKey,
    pruneTransferPending,
    standingTransfers,
    type PendingTransfer,
} from '../pixWithdrawPending'

const NOW = Date.parse('2026-11-10T12:00:00Z')
const mark = (lock: string, submittedAt = NOW, settleBy = NOW + 13 * 60_000) =>
    ({ priceLockCode: lock, display: { amountBrl: '503.00' }, submittedAt, settleBy }) as unknown as PendingTransfer
const stored = (userId = 'u1') => parsePendingTransfers(window.localStorage.getItem(pendingTransfersKey(userId)))

describe('the pending-transfer marks', () => {
    afterEach(() => {
        jest.restoreAllMocks()
        window.localStorage.clear()
    })

    it("keeps one mark per price lock under the account's own key, and clears only the lock asked", () => {
        expect(markTransferPending('u1', mark('lock-a'), NOW)).toBe(true)
        // a second tab's withdrawal adds its own mark, never over the first
        expect(markTransferPending('u1', mark('lock-b', NOW + 1_000), NOW)).toBe(true)
        expect(Object.keys(stored()).sort()).toEqual(['lock-a', 'lock-b'])

        // the second tab's refusal clears its own mark only
        clearTransferPending('u1', 'lock-b')
        expect(Object.keys(stored())).toEqual(['lock-a'])
        clearTransferPending('u1', 'lock-a')
        expect(window.localStorage.getItem(pendingTransfersKey('u1'))).toBeNull()
    })

    it("never writes into or reads from another account's key", () => {
        markTransferPending('u1', mark('lock-a'), NOW)
        markTransferPending('u2', mark('lock-z'), NOW)
        clearTransferPending('u2', 'lock-a')
        expect(Object.keys(stored('u1'))).toEqual(['lock-a'])
        expect(Object.keys(stored('u2'))).toEqual(['lock-z'])
    })

    it('lists the standing marks newest first, and prunes the ones past their window', () => {
        markTransferPending('u1', mark('old', NOW - 20 * 60_000, NOW - 1), NOW - 30 * 60_000)
        markTransferPending('u1', mark('lock-a', NOW), NOW - 30 * 60_000)
        markTransferPending('u1', mark('lock-b', NOW + 5_000), NOW - 30 * 60_000)
        expect(standingTransfers(stored(), NOW).map((kept) => kept.priceLockCode)).toEqual(['lock-b', 'lock-a'])
        pruneTransferPending('u1', NOW)
        expect(Object.keys(stored()).sort()).toEqual(['lock-a', 'lock-b'])
    })

    it('reads a missing or broken value, or a mark filed under another lock, as none', () => {
        expect(parsePendingTransfers(null)).toEqual({})
        expect(parsePendingTransfers('{not json')).toEqual({})
        expect(parsePendingTransfers(JSON.stringify({ 'lock-x': mark('lock-y') }))).toEqual({})
    })

    // quota, private mode or blocked storage: the guard cannot hold, and the caller must not submit
    it('says so when this browser cannot keep a mark', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError')
        })
        expect(canKeepTransferMark()).toBe(false)
        expect(markTransferPending('u1', mark('lock-a'), NOW)).toBe(false)
    })

    it('can keep one where storage works, and the probe leaves nothing behind', () => {
        expect(canKeepTransferMark()).toBe(true)
        expect(window.localStorage.length).toBe(0)
    })
})
