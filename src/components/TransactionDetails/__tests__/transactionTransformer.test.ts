import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { EHistoryUserRole, EHistoryStatus, getTransactionSign, type HistoryEntry } from '@/utils/history.utils'
import { pipelineAlert } from '@/utils/pipelineAlerts'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '', SIMPLEFI: '' }))
jest.mock('@/utils/pipelineAlerts', () => ({ pipelineAlert: jest.fn() }))

type Account = NonNullable<HistoryEntry['recipientAccount']>

const aliceUser: Account = {
    identifier: '0xAliceWalletAddressForTesting000000000000',
    type: 'WALLET_SMART',
    isUser: true,
    username: 'alice',
    fullName: 'Alice Wonderland',
    userId: 'user-alice',
    showFullName: false,
}

const bobUser: Account = {
    identifier: '0xBobWalletAddressForTesting00000000000000',
    type: 'WALLET_SMART',
    isUser: true,
    username: 'bob',
    fullName: 'Bob Builder',
    userId: 'user-bob',
    showFullName: false,
}

const externalEoa: Account = {
    identifier: '0xExternalAddress000000000000000000000000',
    type: 'WALLET_EXTERNAL',
    isUser: false,
}

const ibanAccountES: Account = {
    identifier: 'ES2700750984220607080217',
    type: 'IBAN',
    isUser: false,
}

const baseEntry = (overrides: Partial<HistoryEntry>): HistoryEntry => ({
    uuid: 'test-uuid-' + Math.random().toString(36).slice(2),
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-04-01T12:00:00Z'),
    amount: '1000000',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: EHistoryStatus.COMPLETED,
    userRole: EHistoryUserRole.SENDER,
    recipientAccount: aliceUser,
    extraData: { kind: 'DIRECT_TRANSFER' },
    ...overrides,
})

interface ExpectedShape {
    direction?: string
    userName?: string
    transactionCardType?: string
    isLinkTransaction?: boolean
    bankAccountDetailsDefined?: boolean
    isPeerActuallyUser?: boolean
    cardPaymentDefined?: boolean
}

interface TestCase {
    name: string
    entry: HistoryEntry
    expect: ExpectedShape
}

const cases: TestCase[] = [
    // ───── DIRECT_TRANSFER ─────
    {
        name: 'DIRECT_TRANSFER × SENDER → outgoing send to user',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
            extraData: { kind: 'DIRECT_TRANSFER' },
            isVerified: true,
        }),
        expect: {
            direction: 'send',
            transactionCardType: 'send',
            userName: 'alice',
            isPeerActuallyUser: true,
            isLinkTransaction: false,
        },
    },
    {
        name: 'DIRECT_TRANSFER × RECIPIENT → incoming receive from user',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            extraData: { kind: 'DIRECT_TRANSFER' },
            isVerified: true,
        }),
        expect: { direction: 'receive', transactionCardType: 'receive', userName: 'bob', isPeerActuallyUser: true },
    },

    // ───── SEND_LINK ─────
    {
        name: 'SEND_LINK × SENDER (claimed by peanut user) → send to claimer username',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
            extraData: { kind: 'SEND_LINK' },
            isVerified: true,
        }),
        expect: {
            direction: 'send',
            transactionCardType: 'send',
            userName: 'alice',
            isPeerActuallyUser: true,
            isLinkTransaction: false,
        },
    },
    {
        name: 'SEND_LINK × SENDER (unclaimed external) → "Sent via link"',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.PENDING,
            recipientAccount: { ...externalEoa },
            extraData: { kind: 'SEND_LINK' },
            isVerified: true,
        }),
        expect: {
            direction: 'send',
            transactionCardType: 'send',
            userName: 'Sent via link',
            isPeerActuallyUser: false,
            isLinkTransaction: true,
        },
    },
    {
        name: 'SEND_LINK × RECIPIENT (claimed by external addr) → claim_external',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: externalEoa,
            extraData: { kind: 'SEND_LINK' },
        }),
        expect: {
            direction: 'claim_external',
            transactionCardType: 'claim_external',
            userName: externalEoa.identifier,
            isLinkTransaction: true,
        },
    },
    {
        name: 'SEND_LINK × BOTH → cancelled-by-self (link tx, peer = self)',
        entry: baseEntry({
            userRole: EHistoryUserRole.BOTH,
            recipientAccount: aliceUser,
            extraData: { kind: 'SEND_LINK' },
        }),
        expect: { isLinkTransaction: true },
    },
    {
        name: 'SEND_LINK × RECIPIENT (claimed by peanut user) → receive from claimer',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            extraData: { kind: 'SEND_LINK' },
            isVerified: true,
        }),
        expect: { direction: 'receive', transactionCardType: 'receive', userName: 'bob', isPeerActuallyUser: true },
    },

    // ───── OFFRAMP (Bridge / Manteca) ─────
    {
        name: 'OFFRAMP via BRIDGE → bank_withdraw with bankAccountDetails populated',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: ibanAccountES,
            extraData: { kind: 'OFFRAMP', provider: 'BRIDGE' },
        }),
        expect: {
            direction: 'bank_withdraw',
            transactionCardType: 'bank_withdraw',
            userName: 'Bank Account',
            bankAccountDetailsDefined: true,
        },
    },
    {
        name: 'OFFRAMP via MANTECA → bank_withdraw with bankAccountDetails populated',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: ibanAccountES,
            extraData: { kind: 'OFFRAMP', provider: 'MANTECA' },
        }),
        expect: { direction: 'bank_withdraw', transactionCardType: 'bank_withdraw', bankAccountDetailsDefined: true },
    },

    // ───── ONRAMP ─────
    {
        name: 'ONRAMP via BRIDGE → bank_deposit',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
            extraData: { kind: 'ONRAMP', provider: 'BRIDGE' },
        }),
        expect: { direction: 'bank_deposit', transactionCardType: 'bank_deposit', userName: 'Bank Account' },
    },
    {
        name: 'ONRAMP via MANTECA → bank_deposit',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
            extraData: { kind: 'ONRAMP', provider: 'MANTECA' },
        }),
        expect: { direction: 'bank_deposit', transactionCardType: 'bank_deposit', userName: 'Bank Account' },
    },

    // ───── CRYPTO_DEPOSIT ─────
    {
        name: 'CRYPTO_DEPOSIT → add, with sender identifier',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            extraData: { kind: 'CRYPTO_DEPOSIT' },
            isVerified: true,
        }),
        expect: { direction: 'add', transactionCardType: 'add', userName: 'bob', isPeerActuallyUser: true },
    },
    {
        name: 'CRYPTO_DEPOSIT zero-amount test transaction → memo overridden, sender renders normally',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            amount: '0',
            recipientAccount: aliceUser,
            senderAccount: bobUser,
            extraData: { kind: 'CRYPTO_DEPOSIT' },
        }),
        expect: { direction: 'add', transactionCardType: 'add', userName: 'bob' },
    },

    // ───── QR_PAY ─────
    {
        name: 'QR_PAY → qr_payment / pay',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: { identifier: 'merchant-xyz', type: 'MERCHANT', isUser: false },
            extraData: { kind: 'QR_PAY' },
        }),
        expect: { direction: 'qr_payment', transactionCardType: 'pay', userName: 'merchant-xyz' },
    },

    // ───── PERK_REWARD ─────
    {
        name: 'PERK_REWARD → receive Peanut Reward',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
            extraData: { kind: 'PERK_REWARD' },
        }),
        expect: { direction: 'receive', transactionCardType: 'receive', userName: 'Peanut Reward' },
    },

    // ───── CRYPTO_WITHDRAW ─────
    {
        name: 'CRYPTO_WITHDRAW × SENDER → withdraw to external account',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: externalEoa,
            extraData: { kind: 'CRYPTO_WITHDRAW' },
        }),
        expect: { direction: 'withdraw', transactionCardType: 'withdraw', userName: externalEoa.identifier },
    },
    {
        name: 'CRYPTO_WITHDRAW × RECIPIENT → add (multi-user fulfilment edge)',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: {
                identifier: '0xSomeone0000000000000000000000000000000000',
                type: 'WALLET_EXTERNAL',
                isUser: false,
            },
            recipientAccount: aliceUser,
            extraData: { kind: 'CRYPTO_WITHDRAW' },
        }),
        expect: {
            direction: 'add',
            transactionCardType: 'add',
            userName: '0xSomeone0000000000000000000000000000000000',
        },
    },

    // ───── P2P_REQUEST_FULFILL ─────
    {
        name: 'P2P_REQUEST_FULFILL × RECIPIENT (request received) → request',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            extraData: { kind: 'P2P_REQUEST_FULFILL' },
            isVerified: true,
        }),
        expect: { direction: 'receive', transactionCardType: 'receive', userName: 'bob', isPeerActuallyUser: true },
    },
    {
        name: 'P2P_REQUEST_FULFILL × SENDER × bridge fulfilment → bank_request_fulfillment',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: bobUser,
            extraData: { kind: 'P2P_REQUEST_FULFILL', fulfillmentType: 'bridge' },
        }),
        expect: { direction: 'bank_request_fulfillment', transactionCardType: 'bank_request_fulfillment' },
    },

    // ───── CARD_SPEND_AUTH / CARD_AUTH_REVERSAL ─────
    {
        name: 'CARD_SPEND_AUTH with merchant → qr_payment / card_pay',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
            extraData: { kind: 'CARD_SPEND_AUTH', merchantName: 'Acme Coffee', rainTransactionId: 'rain-123' },
        }),
        expect: {
            direction: 'qr_payment',
            transactionCardType: 'card_pay',
            userName: 'Acme Coffee',
            cardPaymentDefined: true,
        },
    },
    {
        name: 'CARD_SPEND_CLEAR with no merchant → fallback "Card payment"',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
            extraData: { kind: 'CARD_SPEND_CLEAR' },
        }),
        expect: {
            direction: 'qr_payment',
            transactionCardType: 'card_pay',
            userName: 'Card payment',
            cardPaymentDefined: true,
        },
    },
    {
        name: 'OTHER + parentRainTxId → card refund (legacy passthrough)',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
            extraData: { kind: 'OTHER', parentRainTxId: 'rain-456', merchantName: 'Acme Coffee' },
        }),
        expect: {
            direction: 'receive',
            transactionCardType: 'refund',
            userName: 'Refund from Acme Coffee',
            cardPaymentDefined: true,
        },
    },

    // ───── REFUND (Rain + Manteca) ─────
    {
        name: 'REFUND × RAIN → card refund shape (Refund from merchant)',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
            extraData: { kind: 'REFUND', provider: 'RAIN', parentRainTxId: 'rain-789', merchantName: 'Acme Coffee' },
        }),
        expect: {
            direction: 'receive',
            transactionCardType: 'refund',
            userName: 'Refund from Acme Coffee',
            cardPaymentDefined: true,
        },
    },
    {
        name: 'REFUND × MANTECA → generic Refund credit row',
        entry: baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
            extraData: { kind: 'REFUND', provider: 'MANTECA' },
        }),
        expect: { direction: 'receive', transactionCardType: 'refund', userName: 'Refund' },
    },
    {
        name: 'negative CARD_SPEND_AUTH (Rain refund credit) → refund, not card_pay',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            amount: '-14.68',
            status: EHistoryStatus.PENDING,
            recipientAccount: aliceUser,
            extraData: { kind: 'CARD_SPEND_AUTH', provider: 'RAIN', merchantName: 'Acme Coffee' },
        }),
        expect: {
            direction: 'receive',
            transactionCardType: 'refund',
            userName: 'Refund from Acme Coffee',
            cardPaymentDefined: true,
        },
    },

    // ───── Reaper-failed copy ─────
    {
        name: 'reaper-failed DIRECT_TRANSFER (p2p_send_timeout) renders user-friendly copy',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.FAILED,
            recipientAccount: aliceUser,
            extraData: { kind: 'DIRECT_TRANSFER', failReason: 'p2p_send_timeout' },
        }),
        expect: { userName: "Send didn't complete" },
    },
    {
        name: 'reaper-failed OFFRAMP renders bank-transfer copy',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.FAILED,
            recipientAccount: ibanAccountES,
            extraData: { kind: 'OFFRAMP', failReason: 'offramp_timeout' },
        }),
        expect: { userName: "Bank transfer didn't complete" },
    },
    {
        name: 'non-reaper FAILED (no _timeout suffix) keeps original userName',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.FAILED,
            recipientAccount: aliceUser,
            extraData: { kind: 'DIRECT_TRANSFER', failReason: 'validator_max_retries' },
        }),
        expect: { userName: 'alice' },
    },
]

describe('mapTransactionDataForDrawer', () => {
    it.each(cases)('$name', ({ entry, expect: e }) => {
        const result = mapTransactionDataForDrawer(entry).transactionDetails

        if (e.direction !== undefined) expect(result.direction).toBe(e.direction)
        if (e.userName !== undefined) expect(result.userName).toBe(e.userName)
        if (e.transactionCardType !== undefined)
            expect(result.extraDataForDrawer?.transactionCardType).toBe(e.transactionCardType)
        if (e.isLinkTransaction !== undefined)
            expect(result.extraDataForDrawer?.isLinkTransaction).toBe(e.isLinkTransaction)
        if (e.cardPaymentDefined !== undefined)
            expect(!!result.extraDataForDrawer?.cardPayment).toBe(e.cardPaymentDefined)
        if (e.bankAccountDetailsDefined !== undefined)
            expect(!!result.bankAccountDetails).toBe(e.bankAccountDetailsDefined)
        if (e.isPeerActuallyUser !== undefined) {
            // isPeerActuallyUser isn't directly exposed; isVerified output is gated by it
            // (isVerified = entry.isVerified && isPeerActuallyUser). Cases that assert this
            // set entry.isVerified=true, so output isVerified === isPeerActuallyUser.
            expect(result.isVerified).toBe(e.isPeerActuallyUser)
        }
    })

    describe('unknown-kind default arm (forward-compat / regression guard)', () => {
        it('routes an unhandled kind to the fallback (undefined kind on output)', () => {
            // Per `isIntentKind` runtime guard — an unknown kind is NOT
            // passed through verbatim; it's normalised to undefined so the
            // strategy registry routes via `intentFallback`. The wire emits
            // raw kind, but the transformer only echoes back kinds it knows
            // how to render. Adding a new BE kind without a matching FE
            // strategy is therefore detectable (kind=undefined on output).
            const entry = baseEntry({
                userRole: EHistoryUserRole.SENDER,
                recipientAccount: aliceUser,
                extraData: { kind: 'SOMETHING_NEW_THAT_BACKEND_ADDED' },
            })
            const result = mapTransactionDataForDrawer(entry).transactionDetails
            expect(result.direction).toBeDefined()
            expect(result.extraDataForDrawer?.kind).toBeUndefined()
        })
    })

    describe('refund credit rows (status + sign + flag)', () => {
        const negativeAuth = baseEntry({
            userRole: EHistoryUserRole.SENDER,
            amount: '-14.68',
            status: EHistoryStatus.PENDING,
            recipientAccount: aliceUser,
            extraData: { kind: 'CARD_SPEND_AUTH', provider: 'RAIN', merchantName: 'Acme Coffee', usdAmount: '-14.68' },
        })

        it('a negative auth stays pending (never "refunded") so the + sign shows', () => {
            const result = mapTransactionDataForDrawer(negativeAuth).transactionDetails
            expect(result.status).toBe('pending')
            expect(result.direction).toBe('receive')
            // 'refunded'/'failed'/'cancelled' would suppress the sign; a pending
            // receive keeps the '+'. This is what makes the credit read as +$14.68.
            expect(getTransactionSign(result)).toBe('+')
        })

        it('flags the drawer cardPayment as a refund', () => {
            const result = mapTransactionDataForDrawer(negativeAuth).transactionDetails
            expect(result.extraDataForDrawer?.cardPayment?.isRefund).toBe(true)
        })

        it('role-derived display strings follow the refund verdict, not the wire role', () => {
            // Old BE reports userRole=SENDER on a negative auth. The receipt's
            // "Sent/Received" label and the +/- currency symbol key off
            // originalUserRole/currencySymbol — they must agree with the
            // refund header, not assert the user sent the money.
            const result = mapTransactionDataForDrawer(negativeAuth).transactionDetails
            expect(result.extraDataForDrawer?.originalUserRole).toBe(EHistoryUserRole.RECIPIENT)
            expect(result.currencySymbol).toBe('+$')
        })

        it('kind REFUND no longer trips the unknown-transformer-kind pipeline alert', () => {
            jest.mocked(pipelineAlert).mockClear()
            mapTransactionDataForDrawer(
                baseEntry({
                    userRole: EHistoryUserRole.RECIPIENT,
                    recipientAccount: aliceUser,
                    extraData: { kind: 'REFUND', provider: 'MANTECA' },
                })
            )
            expect(pipelineAlert).not.toHaveBeenCalled()
        })
    })
})
