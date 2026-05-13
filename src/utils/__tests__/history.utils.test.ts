/**
 * Regression guards for completeHistoryEntry's amount parsing.
 *
 * Decomplexify Phase 2 unified mapGenericIntent to emit decimal USD strings
 * (e.g. "2.00") via formatAmount on the BE. Pre-Phase-2 the SEND_LINK branch
 * still called BigInt(entry.amount), which throws on a decimal string —
 * crashing the history fetch with "Cannot convert 2.00 to a BigInt" and
 * surfacing as the "Error loading transactions!" UI fallback.
 *
 * These tests lock the contract: any HistoryEntry kind dispatched through
 * mapGenericIntent must accept a decimal amount string without throwing.
 * If a future refactor reintroduces a wei assumption here, this fails.
 */

import { completeHistoryEntry } from '../history.utils'
import type { HistoryEntry } from '../history.utils'

jest.mock('@/app/actions/currency', () => ({ getCurrencyPrice: jest.fn() }))
jest.mock('@/utils/general.utils', () => ({
    getFromLocalStorage: jest.fn(() => null),
    getTokenDetails: jest.fn(() => ({ symbol: 'USDC', decimals: 6 })),
}))

const baseEntry: HistoryEntry = {
    uuid: 'test-uuid',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-05-12T20:00:00Z'),
    amount: '2.00',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d',
    status: 'COMPLETED' as HistoryEntry['status'],
    userRole: 'SENDER' as HistoryEntry['userRole'],
    senderAccount: { identifier: 'alice', type: 'username', isUser: true } as HistoryEntry['senderAccount'],
    recipientAccount: { identifier: 'bob', type: 'username', isUser: true } as HistoryEntry['recipientAccount'],
    extraData: {},
}

describe('completeHistoryEntry amount-contract guards', () => {
    // Every kind routed through mapGenericIntent on the BE emits a decimal
    // string. completeHistoryEntry must accept this format without throwing.
    const decimalKinds = ['SEND_LINK', 'P2P_REQUEST_FULFILL', 'DIRECT_TRANSFER', 'ONRAMP', 'OFFRAMP'] as const

    it.each(decimalKinds)('accepts decimal "2.00" amount for kind=%s without throwing', async (kind) => {
        const entry: HistoryEntry = {
            ...baseEntry,
            extraData: { ...baseEntry.extraData, kind },
        }
        await expect(completeHistoryEntry(entry)).resolves.toBeDefined()
    })

    it('SEND_LINK propagates the decimal amount to extraData.usdAmount', async () => {
        const entry: HistoryEntry = {
            ...baseEntry,
            amount: '2.00',
            extraData: { ...baseEntry.extraData, kind: 'SEND_LINK' },
        }
        const result = await completeHistoryEntry(entry)
        expect(result.extraData?.usdAmount).toBe('2.00')
    })

    it('CRYPTO_DEPOSIT with blockNumber still parses as wei (separate BE path)', async () => {
        // DepositHistoryFetcher emits wei; the blockNumber gate routes there.
        // 2 USDC = 2_000_000 in 6-decimal wei.
        const entry: HistoryEntry = {
            ...baseEntry,
            amount: '2000000',
            extraData: { ...baseEntry.extraData, kind: 'CRYPTO_DEPOSIT', blockNumber: '12345' },
        }
        const result = await completeHistoryEntry(entry)
        expect(result.extraData?.usdAmount).toBe('2')
    })

    it('CRYPTO_DEPOSIT without blockNumber treats amount as decimal', async () => {
        const entry: HistoryEntry = {
            ...baseEntry,
            amount: '2.00',
            extraData: { ...baseEntry.extraData, kind: 'CRYPTO_DEPOSIT' },
        }
        await expect(completeHistoryEntry(entry)).resolves.toBeDefined()
    })
})
