/** @jest-environment jsdom */
import {
    clearTransferPending,
    markTransferPending,
    parsePendingTransfer,
    pendingTransferEntry,
    PENDING_TRANSFER_KEY,
    type PendingTransfer,
} from '../pixWithdrawPending'

const SUBMITTED_AT = Date.parse('2026-11-10T12:00:00Z')
const pending = {
    priceLockCode: 'lock-1',
    display: { amountBrl: '503.00' },
    withdrawUsd: '92.504310',
    submittedAt: SUBMITTED_AT,
    settleBy: SUBMITTED_AT + 13 * 60_000,
} as PendingTransfer
const row = (overrides: Record<string, unknown> = {}) => ({
    uuid: 'm1',
    amount: '92.50431',
    timestamp: new Date(SUBMITTED_AT + 20_000),
    extraData: { kind: 'OFFRAMP' },
    ...overrides,
})

describe('the pending-transfer mark', () => {
    beforeEach(() => window.localStorage.clear())

    it('is written before the submit and read back as written, until it is cleared', () => {
        markTransferPending(pending)
        expect(parsePendingTransfer(window.localStorage.getItem(PENDING_TRANSFER_KEY))).toEqual(pending)
        clearTransferPending()
        expect(window.localStorage.getItem(PENDING_TRANSFER_KEY)).toBeNull()
    })

    it('reads a missing or broken mark as none', () => {
        expect(parsePendingTransfer(null)).toBeNull()
        expect(parsePendingTransfer('{not json')).toBeNull()
        expect(parsePendingTransfer('{"priceLockCode":"x"}')).toBeNull()
    })
})

describe('pendingTransferEntry', () => {
    it("finds the withdrawal's row: a withdrawal of its amount from the submit on", () => {
        expect(pendingTransferEntry(pending, [row()])?.uuid).toBe('m1')
        // a device clock a few minutes ahead still finds it
        expect(pendingTransferEntry(pending, [row({ timestamp: new Date(SUBMITTED_AT - 4 * 60_000) })])?.uuid).toBe(
            'm1'
        )
    })

    it('never takes another row for it: an older withdrawal, another amount, or not a withdrawal', () => {
        expect(
            pendingTransferEntry(pending, [row({ timestamp: new Date(SUBMITTED_AT - 60 * 60_000) })])
        ).toBeUndefined()
        expect(pendingTransferEntry(pending, [row({ amount: '10.00' })])).toBeUndefined()
        expect(pendingTransferEntry(pending, [row({ extraData: { kind: 'ONRAMP' } })])).toBeUndefined()
    })
})
