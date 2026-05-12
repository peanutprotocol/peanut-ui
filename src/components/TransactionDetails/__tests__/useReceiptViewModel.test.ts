// Locks the receipt view model's behaviour for the canonical TI wire shape.
// Two surfaces:
//   1. The "cancelled-sendlink-sender keeps its data" exemption (memo,
//      attachment, token+network visible) — fixed in PR #1966.
//   2. Wire-shape contract for the kind-keyed gates — every row arrives
//      as `originalType='TRANSACTION_INTENT'` + `kind=<IntentKind>`; the
//      view model must light up the right rows from that pair.
import { renderHook } from '@testing-library/react'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
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
        originalType: 'TRANSACTION_INTENT',
        originalUserRole: EHistoryUserRole.SENDER,
        kind: 'SEND_LINK',
    },
} as unknown as TransactionDetails

const withDrawer = (overrides: Record<string, unknown>, drawerOverrides: Record<string, unknown>): TransactionDetails =>
    ({
        ...baseTx,
        ...overrides,
        extraDataForDrawer: { ...(baseTx.extraDataForDrawer as Record<string, unknown>), ...drawerOverrides },
    }) as unknown as TransactionDetails

const renderConfig = (tx: TransactionDetails) =>
    renderHook(() => useReceiptViewModel(tx, { isPublic: false })).result.current.rowVisibilityConfig

const senderSendLink = (status: string): TransactionDetails =>
    withDrawer({ status }, { originalUserRole: EHistoryUserRole.SENDER, kind: 'SEND_LINK' })

const cancelledBankWithdraw = (): TransactionDetails =>
    withDrawer(
        { status: 'cancelled', direction: 'bank_withdraw' },
        { originalUserRole: EHistoryUserRole.SENDER, kind: 'OFFRAMP' }
    )

describe('useReceiptViewModel — cancelled sendlink sender', () => {
    test('shows memo + attachment + token/network when sender cancels their own sendlink', () => {
        const config = renderConfig(senderSendLink('cancelled'))
        expect(config.comment).toBe(true)
        expect(config.attachment).toBe(true)
        expect(config.tokenAndNetwork).toBe(true)
        expect(config.cancelled).toBe(true)
    })

    test('keeps the legacy suppress for a still-pending sender-side sendlink', () => {
        // Pre-cancel state: token+network row is intentionally suppressed
        // (sender already sees that at the top of the drawer); other fields
        // remain visible as before.
        const config = renderConfig(senderSendLink('pending'))
        expect(config.tokenAndNetwork).toBe(false)
        expect(config.comment).toBe(true)
        expect(config.attachment).toBe(true)
    })

    test('still hides memo + attachment for non-sendlink cancelled flows', () => {
        // Bank withdraws genuinely null out their fields on cancel — gates
        // still apply.
        const config = renderConfig(cancelledBankWithdraw())
        expect(config.comment).toBe(false)
        expect(config.attachment).toBe(false)
        // Pre-existing behaviour: tokenAndNetwork has no global `status !==
        // 'cancelled'` gate — only the !isPeanutWalletToken suppress and the
        // sendlink-sender pre-cancel hide. Cancelled non-sendlinks with a
        // non-peanut-wallet token surface this row. Locked so a future
        // status-blanket gate doesn't sneak in.
        expect(config.tokenAndNetwork).toBe(true)
    })
})
