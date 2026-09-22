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
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

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

const renderConfig = (tx: TransactionDetails, isPublic = false) =>
    renderHook(() => useReceiptViewModel(tx, { isPublic })).result.current.rowVisibilityConfig

const senderSendLink = (status: string): TransactionDetails =>
    withDrawer({ status }, { originalUserRole: EHistoryUserRole.SENDER, kind: 'SEND_LINK' })

const cancelledBankWithdraw = (): TransactionDetails =>
    withDrawer(
        { status: 'cancelled', direction: 'bank_withdraw' },
        { originalUserRole: EHistoryUserRole.SENDER, kind: 'OFFRAMP' }
    )

// A non-USD card refund: `direction: 'receive'` (set by the cardRefund
// strategy), carries FX currency, and is flagged as a card entry via the
// cardPayment block on the drawer.
const cardRefund = (overrides: Record<string, unknown> = {}): TransactionDetails =>
    withDrawer(
        {
            direction: 'receive',
            status: 'completed',
            currency: { code: 'ARS', symbol: '$' },
            ...overrides,
        },
        { kind: 'CARD_REFUND', cardPayment: { isRefund: true }, receipt: { exchange_rate: '1412' } }
    )

describe('useReceiptViewModel — card exchange-rate row', () => {
    test('shows the FX rate row for a non-USD card refund (direction=receive)', () => {
        // Regression: the direction allow-list (bank_deposit/qr_payment/
        // bank_withdraw) misses card refunds, which arrive as `receive`. The
        // card-entry predicate fills that gap so the refund shows the same FX
        // rate its matching spend does.
        const config = renderConfig(cardRefund())
        expect(config.exchangeRate).toBe(true)
    })

    test('still suppresses the FX rate row for a USD card refund', () => {
        const config = renderConfig(cardRefund({ currency: { code: 'USD', symbol: '$' } }))
        expect(config.exchangeRate).toBe(false)
    })

    test('shows the FX rate for an OFFRAMP viewed from the send-link-claim side (direction=send)', () => {
        // An OFFRAMP renders as direction `send`/`receive`/`bank_claim` (not
        // just `bank_withdraw`) on the claim + multi-user paths. The old
        // direction allow-list hid the FX row for those; gating on the OFFRAMP
        // *kind* shows it — these are genuine USD→fiat conversions. Locks that
        // intended generalization.
        const offrampAsSend = withDrawer(
            { direction: 'send', status: 'completed', currency: { code: 'ARS', symbol: '$' } },
            { kind: 'OFFRAMP', receipt: { exchange_rate: '1412' } }
        )
        expect(renderConfig(offrampAsSend).exchangeRate).toBe(true)
    })
})

describe('useReceiptViewModel — cancelled sendlink sender', () => {
    test('shows memo + attachment + token/network when sender cancels their own sendlink', () => {
        const config = renderConfig(senderSendLink('cancelled'))
        expect(config.comment).toBe(true)
        expect(config.attachment).toBe(true)
        expect(config.tokenAndNetwork).toBe(true)
        expect(config.statusDate).toBe(true)
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

describe('sender reference row (bank deposits)', () => {
    const bankDeposit = (senderReference?: string): TransactionDetails =>
        withDrawer({ status: 'completed', direction: 'bank_deposit' }, { kind: 'ONRAMP', senderReference })

    it('shows when the deposit carries the payer reference', () => {
        expect(renderConfig(bankDeposit('INVOICE 4471')).senderReference).toBe(true)
    })

    it('stays hidden when the API sends none', () => {
        expect(renderConfig(bankDeposit()).senderReference).toBe(false)
    })

    it('never shows on another kind, even if the field is present', () => {
        const send = withDrawer({ status: 'completed' }, { kind: 'DIRECT_TRANSFER', senderReference: 'x' })
        expect(renderConfig(send).senderReference).toBe(false)
    })

    it('never shows on a public receipt — the payer reference is for the owner', () => {
        // The backend withholds it from a public receipt, but the public page
        // renders this same component tree, so the gate is repeated here.
        expect(renderConfig(bankDeposit('INVOICE 4471'), true).senderReference).toBe(false)
    })
})

describe('payment reference row (bank withdrawals)', () => {
    const withdraw = (paymentReference?: string, status = 'completed'): TransactionDetails =>
        withDrawer({ status, direction: 'bank_withdraw' }, { kind: 'OFFRAMP', paymentReference })

    it('shows the owner the reference we sent with the payout', () => {
        expect(renderConfig(withdraw('hello world')).paymentReference).toBe(true)
    })

    it('stays hidden when the API sends none — an older API, or a rail that takes none', () => {
        expect(renderConfig(withdraw()).paymentReference).toBe(false)
        expect(renderConfig(withdraw('')).paymentReference).toBe(false)
    })

    it('never shows on a public receipt — the reference is for the owner', () => {
        expect(renderConfig(withdraw('hello world'), true).paymentReference).toBe(false)
    })
})

describe('date rows — Created plus one status row', () => {
    const dated = (overrides: Record<string, unknown>) =>
        withDrawer({ createdAt: '2026-05-01T10:00:00.000Z', ...overrides }, { kind: 'OFFRAMP' })

    it('a pending receipt shows Created only', () => {
        const config = renderConfig(dated({ status: 'pending' }))
        expect(config.createdAt).toBe(true)
        expect(config.statusDate).toBe(false)
    })

    it('a completed receipt shows Created and Completed', () => {
        const config = renderConfig(dated({ status: 'completed', completedAt: '2026-05-01T12:00:00.000Z' }))
        expect(config.createdAt).toBe(true)
        expect(config.statusDate).toBe(true)
    })

    it('Created drops out when it prints the same minute as the status row', () => {
        const config = renderConfig(dated({ status: 'completed', completedAt: '2026-05-01T10:00:40.000Z' }))
        expect(config.createdAt).toBe(false)
        expect(config.statusDate).toBe(true)
    })

    it('a cancelled receipt shows Created and Cancelled', () => {
        const config = renderConfig(dated({ status: 'cancelled', cancelledDate: '2026-05-02T09:00:00.000Z' }))
        expect(config.createdAt).toBe(true)
        expect(config.statusDate).toBe(true)
    })

    it('a refunded receipt shows Created and Refunded', () => {
        const config = renderConfig(dated({ status: 'refunded', date: '2026-05-03T09:00:00.000Z' }))
        expect(config.createdAt).toBe(true)
        expect(config.statusDate).toBe(true)
    })
})

describe('conversion rows — one conversion, one row', () => {
    const eurDeposit = (status: string) =>
        withDrawer(
            {
                status,
                direction: 'bank_deposit',
                amount: 24.32,
                currency: { code: 'EUR', amount: '21.33' },
            },
            { kind: 'ONRAMP', receipt: { exchange_rate: '0.8769' } }
        )

    it('settled: the rate folds into the Converted row, no separate Exchange rate row', () => {
        const config = renderConfig(eurDeposit('completed'))
        expect(config.conversion).toBe(true)
        expect(config.exchangeRate).toBe(false)
    })

    it('pending: the estimate and the rate are two rows that say different things', () => {
        const config = renderConfig(eurDeposit('pending'))
        expect(config.conversion).toBe(true)
        expect(config.exchangeRate).toBe(true)
    })

    it('cancelled: neither', () => {
        const config = renderConfig(eurDeposit('cancelled'))
        expect(config.conversion).toBe(false)
        expect(config.exchangeRate).toBe(false)
    })
})

describe('fee rows — one charge, one row', () => {
    const withFees = (fee: number) =>
        withDrawer(
            {
                status: 'completed',
                sourceView: 'status',
                fee,
                networkFeeDetails: { amountDisplay: '$0.05' },
            },
            { kind: 'CRYPTO_WITHDRAW' }
        )

    it('drops Fee when Network fee prints the same number', () => {
        const config = renderConfig(withFees(0.05))
        expect(config.networkFee).toBe(true)
        expect(config.fee).toBe(false)
    })

    it('keeps both when they are different charges', () => {
        const config = renderConfig(withFees(0.5))
        expect(config.networkFee).toBe(true)
        expect(config.fee).toBe(true)
    })
})

describe("From row (deposits into the user's bank details)", () => {
    const vaDeposit = (payerName?: string) =>
        withDrawer(
            { status: 'completed', direction: 'bank_deposit' },
            { kind: 'ONRAMP', isDepositAccountDeposit: true, payerName }
        )

    it('shows for the owner, with or without a payer name', () => {
        expect(renderConfig(vaDeposit('Ana Pérez')).from).toBe(true)
        expect(renderConfig(vaDeposit()).from).toBe(true)
    })

    it('never shows on a public receipt — the payer name is for the owner', () => {
        expect(renderConfig(vaDeposit('Ana Pérez'), true).from).toBe(false)
    })

    it("does not show on the user's own one-off bank deposit", () => {
        const ownDeposit = withDrawer({ status: 'completed', direction: 'bank_deposit' }, { kind: 'ONRAMP' })
        expect(renderConfig(ownDeposit).from).toBe(false)
    })
})
