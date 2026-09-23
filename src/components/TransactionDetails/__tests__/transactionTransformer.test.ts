import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { EHistoryUserRole, EHistoryStatus, getTransactionSign, type HistoryEntry } from '@/utils/history.utils'
import { pipelineAlert } from '@/utils/pipelineAlerts'
import { getTransactionExplorerUrl } from '@/utils/general.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))
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

// A Peanut user who has a display name (showFullName) but no @username — only
// their wallet address as identifier. The strategy must thread fullName +
// showFullName so the avatar resolves to their initials, not the address (which
// would trip isAddress() → wallet icon in TransactionAvatarBadge).
const displayNameOnlyUser: Account = {
    // real hex address so isAddress() would be true on the old code path —
    // faithfully reproduces the "avatar name is an address → wallet icon" symptom.
    identifier: '0x1234567890abcdef1234567890abcdef12345678',
    type: 'WALLET_SMART',
    isUser: true,
    fullName: 'Nancy Drew',
    userId: 'user-nancy',
    showFullName: true,
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
    {
        name: 'P2P_REQUEST_FULFILL × SENDER × bridge fulfilment does not treat the viewer as the peer',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            senderAccount: aliceUser,
            recipientAccount: { identifier: 'external-recipient', type: 'MERCHANT', isUser: false },
            extraData: { kind: 'P2P_REQUEST_FULFILL', fulfillmentType: 'bridge' },
            isVerified: true,
        }),
        expect: {
            direction: 'bank_request_fulfillment',
            transactionCardType: 'bank_request_fulfillment',
            userName: 'external-recipient',
            isPeerActuallyUser: false,
        },
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
    {
        name: 'failed collateral QR_PAY (no reaper reason) renders "Failed QR payment attempt" copy',
        entry: baseEntry({
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.FAILED,
            extraData: { kind: 'QR_PAY', merchantName: 'MERPAGO*CARREFOUR' },
        }),
        // Overrides the misleading "QR payment to <merchant>" the kind-switch
        // would produce for a FAILED row (peanut-api-ts #1146 surfaces these).
        expect: { userName: 'Failed QR payment attempt' },
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

    describe('cross-chain withdrawal transaction proof (TASK-22614)', () => {
        const completedWithdraw = (destinationChain: string, destinationTxHash: string) =>
            baseEntry({
                txHash: '0x' + 'a'.repeat(64),
                status: EHistoryStatus.COMPLETED,
                userRole: EHistoryUserRole.SENDER,
                recipientAccount: externalEoa,
                extraData: { kind: 'CRYPTO_WITHDRAW', destinationChain, destinationTxHash },
            })

        it('links a completed Tron delivery to its destination transaction', () => {
            const result = mapTransactionDataForDrawer(completedWithdraw('TRON', 'b'.repeat(64))).transactionDetails

            expect(result.txHash).toBe('b'.repeat(64))
            expect(result.explorerUrl).toBe(`https://tronscan.org/#/transaction/${'b'.repeat(64)}`)
        })

        it('preserves a case-sensitive Solana signature in the destination link', () => {
            const signature = '2AgqhXGtYtBBaEPLtxUSuvXikE6bb1jF2nbYb61CSEhe78CqrDCCTcyDD6pDbDDjHsVGnrUfEDbKf2utWxM6TCqG'
            const result = mapTransactionDataForDrawer(completedWithdraw('SOLANA', signature)).transactionDetails

            expect(result.txHash).toBe(signature)
            expect(result.explorerUrl).toBe(`https://solscan.io/tx/${signature}`)
        })

        it('keeps a pending withdrawal on the source proof even if destination fields arrive prematurely', () => {
            const sourceHash = '0x' + 'c'.repeat(64)
            const result = mapTransactionDataForDrawer(
                baseEntry({
                    txHash: sourceHash,
                    status: EHistoryStatus.PENDING,
                    userRole: EHistoryUserRole.SENDER,
                    recipientAccount: externalEoa,
                    extraData: {
                        kind: 'CRYPTO_WITHDRAW',
                        destinationChain: 'TRON',
                        destinationTxHash: 'd'.repeat(64),
                    },
                })
            ).transactionDetails

            expect(result.txHash).toBe(sourceHash)
            expect(result.explorerUrl).toContain(`/tx/${sourceHash}`)
            expect(result.explorerUrl).not.toContain('tronscan.org')
        })

        it('preserves the exact Arbitrum Sepolia network for a sandbox proof', () => {
            const sourceHash = '0x' + 'e'.repeat(64)

            expect(getTransactionExplorerUrl('421614', sourceHash)).toBe(`https://sepolia.arbiscan.io/tx/${sourceHash}`)
        })
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

    /**
     * A deposit on a standing account whose refund is on its way back to the
     * payer. The intent stays non-terminal, so its status alone reads as an
     * ordinary deposit still in progress — `extraData.refundInFlight` is the
     * only thing that says the money is going the other way.
     */
    describe('a deposit being returned to the payer', () => {
        const returning = baseEntry({
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
            status: EHistoryStatus.PAYMENT_SUBMITTED,
            extraData: { kind: 'ONRAMP', provider: 'BRIDGE', refundInFlight: true },
        })

        it('names the return instead of the deposit, and stays in progress', () => {
            const result = mapTransactionDataForDrawer(returning).transactionDetails
            expect(result.actionLabelKey).toBe('type.beingReturned')
            expect(result.status).toBe('processing')
        })

        it('leaves an ordinary deposit alone', () => {
            const ordinary = baseEntry({
                userRole: EHistoryUserRole.RECIPIENT,
                recipientAccount: aliceUser,
                status: EHistoryStatus.PAYMENT_SUBMITTED,
                extraData: { kind: 'ONRAMP', provider: 'BRIDGE' },
            })
            expect(mapTransactionDataForDrawer(ordinary).transactionDetails.actionLabelKey).toBeUndefined()
        })

        // Bridge rails map both terminal return statuses to 'failed', which
        // reads as a deposit that never worked. It worked and then went back.
        it.each([EHistoryStatus.REFUNDED, EHistoryStatus.RETURNED])('names the finished return on %s', (status) => {
            const returned = baseEntry({
                userRole: EHistoryUserRole.RECIPIENT,
                recipientAccount: aliceUser,
                status,
                extraData: { kind: 'ONRAMP', provider: 'BRIDGE' },
            })
            const result = mapTransactionDataForDrawer(returned).transactionDetails
            expect(result.actionLabelKey).toBe('type.returnedToSender')
            expect(result.status).toBe('refunded')
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

        it('a negative auth stays pending (never "refunded") and reads as an incoming amount', () => {
            const result = mapTransactionDataForDrawer(negativeAuth).transactionDetails
            expect(result.status).toBe('pending')
            expect(result.direction).toBe('receive')
            // the point is it must NOT read as an outgoing '-' spend.
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

    describe('request-link OPEN status (TASK-20560)', () => {
        // BE forwards the raw link.status (OPEN|CLOSED) for request-link rows.
        // OPEN used to fall to the default 'pending' arm → a paid request kept
        // the hourglass pill forever. Completed requires the collected total to
        // reach the positive goal (`entry.amount`) — a partial or goal-less pot
        // is still awaiting payment.
        const openRequest = (amount: string, totalAmountCollected: number) =>
            baseEntry({
                userRole: EHistoryUserRole.RECIPIENT,
                status: EHistoryStatus.OPEN,
                extraData: { kind: 'P2P_REQUEST_FULFILL' },
                isRequestLink: true,
                amount,
                totalAmountCollected,
            })

        it('a fully-paid open request maps to completed, with the inbound sign', () => {
            const result = mapTransactionDataForDrawer(openRequest('25.00', 25)).transactionDetails
            expect(result.status).toBe('completed')
            expect(result.direction).toBe('request_received')
            expect(getTransactionSign(result)).toBe('+')
        })

        it('float noise in the collected sum cannot leave a fully-paid request pending', () => {
            // three $0.10 contributions: 0.1 + 0.1 + 0.1 === 0.30000000000000004
            const result = mapTransactionDataForDrawer(openRequest('0.30', 0.1 + 0.1 + 0.1)).transactionDetails
            expect(result.status).toBe('completed')
        })

        it('a partially-paid open pot stays pending ($1 of $100)', () => {
            const result = mapTransactionDataForDrawer(openRequest('100', 1)).transactionDetails
            expect(result.status).toBe('pending')
        })

        it('a goal-less open pot stays pending even with contributions', () => {
            const result = mapTransactionDataForDrawer(openRequest('0', 12)).transactionDetails
            expect(result.status).toBe('pending')
        })

        it('an unpaid open request stays pending', () => {
            const result = mapTransactionDataForDrawer(openRequest('100', 0)).transactionDetails
            expect(result.status).toBe('pending')
        })
    })

    describe('sender-side SEND_LINK claim state (TASK-20289)', () => {
        const sentLink = (overrides: Partial<HistoryEntry> = {}) =>
            baseEntry({
                userRole: EHistoryUserRole.SENDER,
                status: EHistoryStatus.COMPLETED,
                recipientAccount: externalEoa,
                extraData: { kind: 'SEND_LINK' },
                ...overrides,
            })

        it('COMPLETED without claimedAt stays pending (escrowed, not yet claimed)', () => {
            const result = mapTransactionDataForDrawer(sentLink()).transactionDetails
            expect(result.status).toBe('pending')
        })

        it('COMPLETED with claimedAt maps to completed', () => {
            const result = mapTransactionDataForDrawer(
                sentLink({ claimedAt: '2026-04-02T09:00:00Z' })
            ).transactionDetails
            expect(result.status).toBe('completed')
        })

        it('raw CLAIMED status maps to completed (BE mirror of parentSendLink.status)', () => {
            const result = mapTransactionDataForDrawer(sentLink({ status: EHistoryStatus.CLAIMED })).transactionDetails
            expect(result.status).toBe('completed')
        })
    })

    describe('direct P2P avatar for display-name-only users (no @username)', () => {
        // Regression guard: p2p-send used to drop fullName/showFullName, so a
        // recipient/sender with only a display name fell back to their wallet
        // address for the avatar name → isAddress() → wallet icon instead of
        // initials. The strategy now threads both, matching every sibling.
        it('outgoing send resolves the recipient display name → initials, not the address', () => {
            const result = mapTransactionDataForDrawer(
                baseEntry({
                    userRole: EHistoryUserRole.SENDER,
                    recipientAccount: displayNameOnlyUser,
                    extraData: { kind: 'DIRECT_TRANSFER' },
                })
            ).transactionDetails
            expect(result.fullName).toBe('Nancy Drew')
            expect(result.showFullName).toBe(true)
            expect(result.initials).toBe('ND')
        })

        it('incoming receive resolves the sender display name → initials, not the address', () => {
            const result = mapTransactionDataForDrawer(
                baseEntry({
                    userRole: EHistoryUserRole.RECIPIENT,
                    senderAccount: displayNameOnlyUser,
                    recipientAccount: aliceUser,
                    extraData: { kind: 'DIRECT_TRANSFER' },
                })
            ).transactionDetails
            expect(result.fullName).toBe('Nancy Drew')
            expect(result.showFullName).toBe(true)
            expect(result.initials).toBe('ND')
        })
    })

    describe('counterparty avatarKey (TASK-22625)', () => {
        const detailsOf = (entry: HistoryEntry) => mapTransactionDataForDrawer(entry).transactionDetails

        it('carries the recipient pick on an outgoing send', () => {
            const result = detailsOf(
                baseEntry({
                    userRole: EHistoryUserRole.SENDER,
                    recipientAccount: { ...aliceUser, avatarKey: 'basic.frog' },
                    extraData: { kind: 'DIRECT_TRANSFER' },
                })
            )
            expect(result.avatarKey).toBe('basic.frog')
        })

        it('carries the sender pick on an incoming receive', () => {
            const result = detailsOf(
                baseEntry({
                    userRole: EHistoryUserRole.RECIPIENT,
                    senderAccount: { ...bobUser, avatarKey: 'badge.OG.hat' },
                    recipientAccount: aliceUser,
                    extraData: { kind: 'DIRECT_TRANSFER' },
                })
            )
            expect(result.avatarKey).toBe('badge.OG.hat')
        })

        it('carries the sender pick on a claimed send link', () => {
            const result = detailsOf(
                baseEntry({
                    userRole: EHistoryUserRole.RECIPIENT,
                    senderAccount: { ...bobUser, avatarKey: 'basic.frog' },
                    recipientAccount: aliceUser,
                    extraData: { kind: 'SEND_LINK' },
                })
            )
            expect(result.avatarKey).toBe('basic.frog')
        })

        it('is null when the counterparty is not a Peanut user', () => {
            const result = detailsOf(
                baseEntry({
                    userRole: EHistoryUserRole.SENDER,
                    recipientAccount: externalEoa,
                    extraData: { kind: 'DIRECT_TRANSFER' },
                })
            )
            expect(result.avatarKey).toBeNull()
        })

        it('is null when the user has no pick', () => {
            const result = detailsOf(
                baseEntry({
                    userRole: EHistoryUserRole.SENDER,
                    recipientAccount: aliceUser,
                    extraData: { kind: 'DIRECT_TRANSFER' },
                })
            )
            expect(result.avatarKey).toBeNull()
        })

        // The reaper rewrites the name to system copy ("Transaction did not
        // complete") — keeping the sticker beside it would still read as "sent
        // to alice".
        it('drops the pick on a reaper-failed row', () => {
            const result = detailsOf(
                baseEntry({
                    status: EHistoryStatus.FAILED,
                    userRole: EHistoryUserRole.SENDER,
                    recipientAccount: { ...aliceUser, avatarKey: 'basic.frog' },
                    extraData: { kind: 'DIRECT_TRANSFER', failReason: 'DIRECT_TRANSFER_timeout' },
                })
            )
            expect(result.avatarKey).toBeNull()
        })

        // A bank send-link claimed by a Peanut user renders as a send to them,
        // and the recipient-side offramp edge renders as a receive — both are
        // person rows, so both must carry the pick.
        it('carries the claimer pick on a bank send-link claim', () => {
            const result = detailsOf(
                baseEntry({
                    userRole: EHistoryUserRole.SENDER,
                    recipientAccount: { ...aliceUser, avatarKey: 'basic.frog' },
                    extraData: { kind: 'OFFRAMP', bridgeFlow: 'BANK_SEND_LINK_CLAIM' },
                })
            )
            expect(result.avatarKey).toBe('basic.frog')
        })

        it('carries the initiator pick on a received bank withdraw', () => {
            const result = detailsOf(
                baseEntry({
                    userRole: EHistoryUserRole.RECIPIENT,
                    senderAccount: { ...bobUser, avatarKey: 'basic.frog' },
                    recipientAccount: aliceUser,
                    extraData: { kind: 'OFFRAMP' },
                })
            )
            expect(result.avatarKey).toBe('basic.frog')
        })

        it('drops the pick on a failed QR payment', () => {
            const result = detailsOf(
                baseEntry({
                    status: EHistoryStatus.FAILED,
                    userRole: EHistoryUserRole.SENDER,
                    recipientAccount: { ...aliceUser, avatarKey: 'basic.frog' },
                    extraData: { kind: 'QR_PAY' },
                })
            )
            expect(result.avatarKey).toBeNull()
        })
    })

    describe('sender reference on a bank deposit', () => {
        const deposit = (senderReference?: string | null) =>
            mapTransactionDataForDrawer(
                baseEntry({
                    userRole: EHistoryUserRole.RECIPIENT,
                    recipientAccount: aliceUser,
                    extraData: { kind: 'ONRAMP', provider: 'BRIDGE', senderReference },
                })
            ).transactionDetails

        it('reaches the drawer trimmed', () => {
            expect(deposit('  INVOICE 4471 ').extraDataForDrawer?.senderReference).toBe('INVOICE 4471')
        })

        it('is absent when the API sends none or blank', () => {
            expect(deposit().extraDataForDrawer?.senderReference).toBeUndefined()
            expect(deposit('   ').extraDataForDrawer?.senderReference).toBeUndefined()
        })

        it('is absent when the bank sent a SEPA placeholder instead of a note', () => {
            expect(deposit('/ROC/NOT PROVIDED').extraDataForDrawer?.senderReference).toBeUndefined()
            expect(deposit('/ROC/').extraDataForDrawer?.senderReference).toBeUndefined()
            expect(deposit('NOTPROVIDED').extraDataForDrawer?.senderReference).toBeUndefined()
        })
    })

    describe("payer of a deposit into the user's bank details", () => {
        // Shapes from peanut-api-ts src/db/history.ts: a deposit-account
        // deposit has the payer's bank as sender, typed by its rail; the
        // user's own one-off deposit has their wallet as sender.
        const deposit = (senderAccount: HistoryEntry['senderAccount']) =>
            mapTransactionDataForDrawer(
                baseEntry({
                    userRole: EHistoryUserRole.RECIPIENT,
                    senderAccount,
                    recipientAccount: aliceUser,
                    extraData: { kind: 'ONRAMP', provider: 'BRIDGE' },
                })
            ).transactionDetails.extraDataForDrawer

        it('carries the payer name the bank reported', () => {
            const drawer = deposit({ identifier: '', type: 'sepa', isUser: false, fullName: ' Ana Pérez ' })
            expect(drawer?.isDepositAccountDeposit).toBe(true)
            expect(drawer?.payerName).toBe('Ana Pérez')
        })

        it('is still a deposit-account deposit when the bank sent no name', () => {
            const drawer = deposit({ identifier: '', type: 'sepa', isUser: false })
            expect(drawer?.isDepositAccountDeposit).toBe(true)
            expect(drawer?.payerName).toBeUndefined()
        })

        it('is not one for a Manteca deposit, whose sender is also a bank account', () => {
            // peanut-api-ts src/manteca/history.ts: the user's own CBU transfer.
            const drawer = mapTransactionDataForDrawer(
                baseEntry({
                    userRole: EHistoryUserRole.RECIPIENT,
                    senderAccount: { identifier: 'Manteca Deposit', type: 'BANK_CBU', isUser: false },
                    recipientAccount: aliceUser,
                    extraData: { kind: 'ONRAMP', provider: 'MANTECA' },
                })
            ).transactionDetails.extraDataForDrawer
            expect(drawer?.isDepositAccountDeposit).toBeUndefined()
            expect(drawer?.payerName).toBeUndefined()
        })

        it("is not one when the sender is the user's own wallet or an address", () => {
            expect(
                deposit({ identifier: '0xabc', type: 'peanut-wallet', isUser: true })?.isDepositAccountDeposit
            ).toBeUndefined()
            expect(
                deposit({ identifier: '0xabc', type: 'evm-address', isUser: false })?.isDepositAccountDeposit
            ).toBeUndefined()
        })
    })

    describe('payment reference on a bank withdrawal', () => {
        // The API key is `extraData.paymentReference` (peanut-api-ts
        // `src/db/history.ts`). An earlier attempt read `payoutReference` and
        // therefore rendered nothing — this test pins the real key.
        const withdraw = (paymentReference?: string | null) =>
            mapTransactionDataForDrawer(
                baseEntry({
                    userRole: EHistoryUserRole.SENDER,
                    extraData: { kind: 'OFFRAMP', provider: 'BRIDGE', paymentReference },
                })
            ).transactionDetails

        it('reaches the drawer trimmed', () => {
            expect(withdraw('  hello world ').extraDataForDrawer?.paymentReference).toBe('hello world')
        })

        it('is absent when the API sends none or blank — an older API, or a rail that takes none', () => {
            expect(withdraw().extraDataForDrawer?.paymentReference).toBeUndefined()
            expect(withdraw('   ').extraDataForDrawer?.paymentReference).toBeUndefined()
        })
    })

    describe('Bridge wire status (QA ledger AL6: deposit stuck on "Processing")', () => {
        const bridgeDeposit = (status: string, overrides: Partial<HistoryEntry> = {}) =>
            mapTransactionDataForDrawer(
                baseEntry({
                    status: status as HistoryEntry['status'],
                    userRole: EHistoryUserRole.RECIPIENT,
                    recipientAccount: aliceUser,
                    extraData: { kind: 'ONRAMP', provider: 'BRIDGE' },
                    ...overrides,
                })
            ).transactionDetails

        beforeEach(() => jest.mocked(pipelineAlert).mockClear())

        it('COMPLETED, the word a deposit-account deposit arrives with, reads completed', () => {
            const details = bridgeDeposit('COMPLETED')
            expect(details.direction).toBe('bank_deposit')
            expect(details.status).toBe('completed')
            expect(pipelineAlert).not.toHaveBeenCalled()
        })

        it('PAYMENT_PROCESSED still reads completed', () => {
            expect(bridgeDeposit('PAYMENT_PROCESSED').status).toBe('completed')
        })

        it.each([
            ['FAILED', 'failed'],
            ['EXPIRED', 'failed'],
            ['CANCELLED', 'cancelled'],
        ])('the intent word %s reads %s, not processing', (status, expected) => {
            expect(bridgeDeposit(status).status).toBe(expected)
        })

        it('an unknown word defers to the completion stamp and is reported once', () => {
            const stamped = { completedAt: '2026-09-18T12:09:36.000Z' }
            expect(bridgeDeposit('SETTLED_V2', stamped).status).toBe('completed')
            expect(bridgeDeposit('SETTLED_V2', stamped).status).toBe('completed')
            expect(pipelineAlert).toHaveBeenCalledTimes(1)
            expect(pipelineAlert).toHaveBeenCalledWith(
                'projection_drift',
                expect.stringContaining('SETTLED_V2'),
                expect.any(Object),
                'warning'
            )
        })

        it('an unknown word defers to the cancellation stamp', () => {
            expect(bridgeDeposit('VOIDED_V2', { cancelledAt: '2026-09-18T12:09:36.000Z' }).status).toBe('cancelled')
        })

        it('an unknown word with no terminal stamp stays processing', () => {
            expect(bridgeDeposit('SOMETHING_NEW').status).toBe('processing')
        })
    })
})
