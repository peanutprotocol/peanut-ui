// Locks two behaviours of the receipt view model:
//
// 1. The "cancelled-sendlink-sender keeps its data" exemption (memo,
//    attachment, token+network visible) — staging regression playtested
//    2026-05-09, fixed in PR #1966.
// 2. Wire-shape PARITY between legacy `originalType` rows and the
//    post-decomplexify `TRANSACTION_INTENT + kind=<>` rows. Until this PR,
//    half a dozen gates checked `originalType === EHistoryEntryType.X`
//    one-sided, so the receipt drawer silently regressed for every new
//    sendlink / request / onramp row on staging. The parity tests below feed
//    equivalent legacy + intent shapes through the same view model and assert
//    the rowVisibilityConfig is identical. Future one-sided gates fail here.
import { renderHook } from '@testing-library/react'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import type { IntentKind } from '../strategies/registry'

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

// Fixture builders that bypass the heavy TransactionDetails type so each
// test case can express only the fields the assertion cares about. Cast at
// the boundary rather than threading deep types through every literal.
const withDrawer = (overrides: Record<string, unknown>, drawerOverrides: Record<string, unknown>): TransactionDetails =>
    ({
        ...baseTx,
        ...overrides,
        extraDataForDrawer: { ...(baseTx.extraDataForDrawer as Record<string, unknown>), ...drawerOverrides },
    }) as unknown as TransactionDetails

const renderConfig = (tx: TransactionDetails) =>
    renderHook(() => useReceiptViewModel(tx, { isPublic: false })).result.current.rowVisibilityConfig

const senderSendLink = (status: string): TransactionDetails =>
    withDrawer({ status }, { originalType: EHistoryEntryType.SEND_LINK, originalUserRole: EHistoryUserRole.SENDER })

const cancelledBankWithdraw = (): TransactionDetails =>
    withDrawer(
        { status: 'cancelled', direction: 'bank_withdraw' },
        { originalType: EHistoryEntryType.BRIDGE_OFFRAMP, originalUserRole: EHistoryUserRole.SENDER }
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

// Decomplexify changed the wire shape for several entry types. The receipt
// drawer must render the same fields whether the row is legacy or post-M3 —
// otherwise the bug we shipped silently (QR/Share/Cancel block missing on
// every new pending sendlink) comes back. Each row pair below is the same
// real-world event in both shapes.
type ParityCase = {
    name: string
    legacy: Record<string, unknown>
    legacyDrawer: Record<string, unknown>
    // Pinned to the strategy-registry IntentKind union: a kind not in the
    // registry won't compile, so a future parity case can't reference a
    // post-M3 wire kind the receipt doesn't actually know how to render.
    intentKind: IntentKind
    extraDrawer?: Record<string, unknown>
}

const PARITY_CASES: ParityCase[] = [
    {
        name: 'pending sendlink, sender side',
        legacy: { status: 'pending' },
        legacyDrawer: { originalType: EHistoryEntryType.SEND_LINK, originalUserRole: EHistoryUserRole.SENDER },
        intentKind: 'LINK_CREATE',
    },
    {
        name: 'cancelled sendlink, sender side (the original regression)',
        legacy: { status: 'cancelled' },
        legacyDrawer: { originalType: EHistoryEntryType.SEND_LINK, originalUserRole: EHistoryUserRole.SENDER },
        intentKind: 'LINK_CREATE',
    },
    {
        name: 'completed sendlink, sender side',
        legacy: { status: 'completed', completedAt: '2026-05-02T00:00:00.000Z' as unknown as Date },
        legacyDrawer: { originalType: EHistoryEntryType.SEND_LINK, originalUserRole: EHistoryUserRole.SENDER },
        intentKind: 'LINK_CREATE',
    },
    {
        name: 'pending request, recipient side (request pot OR individual)',
        legacy: { status: 'pending', direction: 'request_sent' },
        legacyDrawer: { originalType: EHistoryEntryType.REQUEST, originalUserRole: EHistoryUserRole.RECIPIENT },
        intentKind: 'REQUEST_PAY',
    },
    {
        name: 'pending request, payer side (about to pay)',
        legacy: { status: 'pending' },
        legacyDrawer: { originalType: EHistoryEntryType.REQUEST, originalUserRole: EHistoryUserRole.SENDER },
        intentKind: 'REQUEST_PAY',
    },
    {
        name: 'pending bridge onramp with deposit instructions',
        legacy: {
            status: 'pending',
            direction: 'bank_deposit',
        },
        legacyDrawer: {
            originalType: EHistoryEntryType.BRIDGE_ONRAMP,
            originalUserRole: EHistoryUserRole.RECIPIENT,
            depositInstructions: { bank_name: 'Test Bank' },
        },
        intentKind: 'FIAT_ONRAMP',
    },
    {
        name: 'pending manteca onramp (renders ARS/BRL deposit-info row)',
        legacy: { status: 'pending', direction: 'bank_deposit', currency: { code: 'ARS', symbol: '$' } },
        legacyDrawer: { originalType: EHistoryEntryType.MANTECA_ONRAMP, originalUserRole: EHistoryUserRole.RECIPIENT },
        intentKind: 'FIAT_ONRAMP',
    },
    {
        name: 'completed direct send',
        legacy: { status: 'completed', completedAt: '2026-05-02T00:00:00.000Z' as unknown as Date },
        legacyDrawer: { originalType: EHistoryEntryType.DIRECT_SEND, originalUserRole: EHistoryUserRole.SENDER },
        intentKind: 'P2P_SEND',
    },
]

describe('useReceiptViewModel — wire-shape parity (legacy ↔ TRANSACTION_INTENT)', () => {
    for (const { name, legacy, legacyDrawer, intentKind, extraDrawer = {} } of PARITY_CASES) {
        test(name, () => {
            const legacyRow = withDrawer(legacy, { ...legacyDrawer, ...extraDrawer })
            const intentRow = withDrawer(legacy, {
                ...legacyDrawer,
                ...extraDrawer,
                originalType: EHistoryEntryType.TRANSACTION_INTENT,
                kind: intentKind,
            })

            const legacyConfig = renderConfig(legacyRow)
            const intentConfig = renderConfig(intentRow)

            // Whole-config equality — any divergence is a one-sided gate.
            expect(intentConfig).toEqual(legacyConfig)
        })
    }
})
