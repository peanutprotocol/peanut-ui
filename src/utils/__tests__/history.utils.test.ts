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

import { completeHistoryEntry, getAvatarUrl, getReceiptUrl, getTransactionSign } from '../history.utils'
import type { HistoryEntry } from '../history.utils'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

jest.mock('@/app/actions/currency', () => ({ getCachedCurrencyPrice: jest.fn() }))
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

/**
 * getTransactionSign drives the +/- prefix on the activity-feed amount.
 *
 * Regression: a Rain card AUTH sits in `pending` for hours until the CLEAR
 * webhook settles it. The old guard suppressed the sign for anything that
 * wasn't `completed`, so a clearly-outgoing card spend rendered a bare
 * `$30.24` next to a peer transfer's `-$30.24`. The sign must reflect the
 * direction for any live/reserved status — only states with their own visual
 * treatment (cancelled/failed/refunded) stay sign-less.
 */
describe('getTransactionSign', () => {
    const sign = (direction: string, status?: string) =>
        getTransactionSign({ direction, status } as Pick<TransactionDetails, 'direction' | 'status'>)

    it('shows the outflow sign for a pending card spend (qr_payment)', () => {
        expect(sign('qr_payment', 'pending')).toBe('-')
    })

    it('shows the outflow sign for a completed card spend', () => {
        expect(sign('qr_payment', 'completed')).toBe('-')
    })

    it('shows the inflow sign for a pending receive', () => {
        expect(sign('receive', 'pending')).toBe('+')
    })

    it.each(['cancelled', 'failed', 'refunded'])('suppresses the sign for status=%s', (status) => {
        expect(sign('qr_payment', status)).toBe('')
        expect(sign('receive', status)).toBe('')
    })

    it.each(['processing', 'soon', 'closed'])('still signs %s transactions', (status) => {
        expect(sign('send', status)).toBe('-')
    })
})

/**
 * getReceiptUrl decides which kinds get a shareable /receipt page URL.
 * Locks the FIAT_RAIL_KINDS + SEND_LINK set so the predicate unification
 * can't silently grow or shrink the receipt-URL surface.
 */
describe('getReceiptUrl', () => {
    const tx = (kind?: string, link?: string) =>
        ({
            id: 'entry-1',
            extraDataForDrawer: { kind, link },
        }) as unknown as Parameters<typeof getReceiptUrl>[0]

    it.each(['QR_PAY', 'ONRAMP', 'OFFRAMP', 'SEND_LINK'])('gives kind=%s a /receipt page URL', (kind) => {
        expect(getReceiptUrl(tx(kind))).toContain(`/receipt/entry-1?kind=${kind}`)
    })

    it('falls back to the stamped link for non-receipt-page kinds', () => {
        expect(getReceiptUrl(tx('DIRECT_TRANSFER', 'https://peanut.me/x'))).toBe('https://peanut.me/x')
    })

    it('returns undefined with no kind match and no stamped link', () => {
        expect(getReceiptUrl(tx('CRYPTO_DEPOSIT'))).toBeUndefined()
    })
})

/**
 * getAvatarUrl maps QR_PAY rows to a payment-app logo by provider. Providers
 * that were removed from the FE (DEPRECATED_SIMPLEFI — 247 historical rows
 * still arrive on the wire) must fall back to undefined, which the avatar
 * components render as the generic default avatar. Locks that historical rows
 * never crash or regress into a broken image.
 */
describe('getAvatarUrl', () => {
    const tx = (provider: string, currencyCode?: string) =>
        ({
            extraDataForDrawer: { kind: 'QR_PAY', provider },
            currency: currencyCode ? { code: currencyCode, amount: '1' } : undefined,
        }) as unknown as Parameters<typeof getAvatarUrl>[0]

    it('still resolves a logo for live QR providers (MANTECA/ARS)', () => {
        expect(getAvatarUrl(tx('MANTECA', 'ARS'))).toBeDefined()
    })

    it('falls back to undefined (generic avatar) for historical DEPRECATED_SIMPLEFI rows', () => {
        expect(getAvatarUrl(tx('DEPRECATED_SIMPLEFI', 'ARS'))).toBeUndefined()
    })
})
