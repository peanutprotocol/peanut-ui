/** @jest-environment jsdom */
import {
    canKeepTransferMark,
    clearTransferPending,
    markTransferPending,
    parsePendingTransfer,
    pendingTransferKey,
    pruneTransferPending,
    readTransfersPending,
    standingTransfers,
    type PendingTransfer,
} from '../pixWithdrawPending'

const NOW = Date.parse('2026-11-10T12:00:00Z')
const mark = (lock: string, submittedAt = NOW, settleBy = NOW + 13 * 60_000) =>
    ({ priceLockCode: lock, display: { amountBrl: '503.00' }, submittedAt, settleBy }) as unknown as PendingTransfer
const locks = (userId = 'u1') => readTransfersPending(userId).map((kept) => kept.priceLockCode)

describe('the pending-transfer marks', () => {
    afterEach(() => {
        jest.restoreAllMocks()
        window.localStorage.clear()
    })

    it("keeps each lock's mark under its own key, and clears only the lock asked", () => {
        expect(markTransferPending('u1', mark('lock-a'))).toBe(true)
        expect(markTransferPending('u1', mark('lock-b', NOW + 1_000))).toBe(true)
        expect(window.localStorage.getItem(pendingTransferKey('u1', 'lock-a'))).toBe(JSON.stringify(mark('lock-a')))
        expect(locks()).toEqual(['lock-a', 'lock-b'])

        // the second tab's refusal clears its own mark only
        clearTransferPending('u1', 'lock-b')
        expect(locks()).toEqual(['lock-a'])
        clearTransferPending('u1', 'lock-a')
        expect(window.localStorage.length).toBe(0)
    })

    // tab B read the account's marks before tab A wrote; B's write cannot carry that stale read
    it("keeps tab A's mark when tab B writes after reading the marks before A wrote", () => {
        const staleInB = readTransfersPending('u1')
        expect(markTransferPending('u1', mark('lock-a'))).toBe(true)
        expect(markTransferPending('u1', mark('lock-b', NOW + 1_000))).toBe(true)
        expect(staleInB).toEqual([])
        // both read back, and A's reload still finds its mark
        expect(locks()).toEqual(['lock-a', 'lock-b'])
        expect(standingTransfers(readTransfersPending('u1'), NOW)[1].priceLockCode).toBe('lock-a')
    })

    it("never reads or clears another account's marks, even one whose id starts the same", () => {
        markTransferPending('u1', mark('lock-a'))
        markTransferPending('u10', mark('lock-z'))
        clearTransferPending('u10', 'lock-a')
        pruneTransferPending('u10', NOW + 60 * 60_000)
        expect(locks('u1')).toEqual(['lock-a'])
        expect(locks('u10')).toEqual([])
    })

    it('lists the standing marks newest first, and prunes the ones past their window', () => {
        markTransferPending('u1', mark('old', NOW - 20 * 60_000, NOW - 1))
        markTransferPending('u1', mark('lock-a', NOW))
        markTransferPending('u1', mark('lock-b', NOW + 5_000))
        expect(standingTransfers(readTransfersPending('u1'), NOW).map((kept) => kept.priceLockCode)).toEqual([
            'lock-b',
            'lock-a',
        ])
        pruneTransferPending('u1', NOW)
        expect(locks()).toEqual(['lock-a', 'lock-b'])
    })

    it('removes an unreadable mark, and the account map and unscoped key earlier builds wrote', () => {
        markTransferPending('u1', mark('lock-a'))
        window.localStorage.setItem(pendingTransferKey('u1', 'broken'), '{not json')
        window.localStorage.setItem(pendingTransferKey('u1', 'lock-x'), JSON.stringify(mark('lock-y')))
        window.localStorage.setItem('pix-withdraw-pending:u1', JSON.stringify({ 'lock-m': mark('lock-m') }))
        window.localStorage.setItem('pix-withdraw-pending', JSON.stringify(mark('lock-u')))
        window.localStorage.setItem('pix-withdraw-pending:u2', JSON.stringify({ 'lock-n': mark('lock-n') }))
        expect(locks()).toEqual(['lock-a'])

        pruneTransferPending('u1', NOW)
        const left = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)).sort()
        // another account's old map is its own to remove when it signs in
        expect(left).toEqual(['pix-withdraw-pending:u1:lock-a', 'pix-withdraw-pending:u2'])
    })

    it('reads a missing or broken value, or a mark filed under another lock, as none', () => {
        expect(parsePendingTransfer(null, 'lock-a')).toBeNull()
        expect(parsePendingTransfer('{not json', 'lock-a')).toBeNull()
        expect(parsePendingTransfer(JSON.stringify(mark('lock-y')), 'lock-x')).toBeNull()
        expect(parsePendingTransfer(JSON.stringify(mark('lock-a')), 'lock-a')).toEqual(mark('lock-a'))
    })

    // quota, private mode or blocked storage: the guard cannot hold, and the caller must not submit
    it('says so when this browser cannot keep a mark', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError')
        })
        expect(canKeepTransferMark()).toBe(false)
        expect(markTransferPending('u1', mark('lock-a'))).toBe(false)
    })

    it('can keep one where storage works, and the probe leaves nothing behind', () => {
        expect(canKeepTransferMark()).toBe(true)
        expect(window.localStorage.length).toBe(0)
    })
})
