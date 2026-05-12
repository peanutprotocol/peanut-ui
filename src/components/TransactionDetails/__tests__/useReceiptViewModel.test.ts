// Locks the "cancelled-sendlink-sender keeps its data" visibility rule
// so the staging regression (cancelled sendlink → empty receipt drawer)
// can't come back.
import { renderHook } from '@testing-library/react'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '', SIMPLEFI: '' }))

const baseTx: TransactionDetails = {
    id: 'tx-1',
    amount: '5',
    currency: { code: 'USD', symbol: '$' },
    direction: 'send',
    status: 'pending',
    createdAt: '2026-05-01T00:00:00.000Z',
    txHash: '0xtxhash',
    memo: 'pizza money',
    attachmentUrl: 'https://example.com/receipt.png',
    fee: 0,
    points: 0,
    sourceView: 'history',
    tokenSymbol: 'USDC',
    tokenDisplayDetails: {
        tokenSymbol: 'USDC',
        chainName: 'Polygon',
        tokenIcon: '',
        chainIcon: '',
    },
    extraDataForDrawer: {
        originalType: EHistoryEntryType.SEND_LINK,
        originalUserRole: EHistoryUserRole.SENDER,
    },
} as unknown as TransactionDetails

const senderSendLink = (status: string): TransactionDetails =>
    ({
        ...baseTx,
        status,
        extraDataForDrawer: {
            ...baseTx.extraDataForDrawer,
            originalType: EHistoryEntryType.SEND_LINK,
            originalUserRole: EHistoryUserRole.SENDER,
        },
    }) as TransactionDetails

const cancelledBankWithdraw = (): TransactionDetails =>
    ({
        ...baseTx,
        status: 'cancelled',
        direction: 'bank_withdraw',
        extraDataForDrawer: {
            originalType: EHistoryEntryType.BRIDGE_OFFRAMP,
            originalUserRole: EHistoryUserRole.SENDER,
        },
    }) as TransactionDetails

describe('useReceiptViewModel — cancelled sendlink sender', () => {
    test('shows memo + attachment + token/network when sender cancels their own sendlink', () => {
        const tx = senderSendLink('cancelled')
        const { result } = renderHook(() => useReceiptViewModel(tx, { isPublic: false }))

        expect(result.current.rowVisibilityConfig.comment).toBe(true)
        expect(result.current.rowVisibilityConfig.attachment).toBe(true)
        expect(result.current.rowVisibilityConfig.tokenAndNetwork).toBe(true)
        expect(result.current.rowVisibilityConfig.cancelled).toBe(true)
    })

    test('keeps the legacy suppress for a still-pending sender-side sendlink', () => {
        // Pre-cancel state: token+network row is intentionally suppressed
        // (sender already sees that at the top of the drawer); other fields
        // remain visible as before.
        const tx = senderSendLink('pending')
        const { result } = renderHook(() => useReceiptViewModel(tx, { isPublic: false }))

        expect(result.current.rowVisibilityConfig.tokenAndNetwork).toBe(false)
        expect(result.current.rowVisibilityConfig.comment).toBe(true)
        expect(result.current.rowVisibilityConfig.attachment).toBe(true)
    })

    test('still hides memo + attachment for non-sendlink cancelled flows', () => {
        // Bank withdraws etc. genuinely null out their fields on cancel —
        // those gates must still apply.
        const tx = cancelledBankWithdraw()
        const { result } = renderHook(() => useReceiptViewModel(tx, { isPublic: false }))

        expect(result.current.rowVisibilityConfig.comment).toBe(false)
        expect(result.current.rowVisibilityConfig.attachment).toBe(false)
        // Pre-existing behaviour: tokenAndNetwork has no global `status !==
        // 'cancelled'` gate — only a `!isPeanutWalletToken` suppress and the
        // sendlink-sender pre-cancel hide. Cancelled non-sendlinks with a
        // non-peanut-wallet token still surface this row. Lock that here so
        // a future status-blanket gate doesn't sneak in unnoticed.
        expect(result.current.rowVisibilityConfig.tokenAndNetwork).toBe(true)
    })
})
