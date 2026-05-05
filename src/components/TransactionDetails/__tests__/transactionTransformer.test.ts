import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { EHistoryEntryType, EHistoryUserRole, EHistoryStatus, type HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '', SIMPLEFI: '' }))

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
    type: EHistoryEntryType.DIRECT_SEND,
    timestamp: new Date('2026-04-01T12:00:00Z'),
    amount: '1000000',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: EHistoryStatus.COMPLETED,
    userRole: EHistoryUserRole.SENDER,
    recipientAccount: aliceUser,
    ...overrides,
})

interface ExpectedShape {
    direction?: string
    userName?: string
    transactionCardType?: string
    isLinkTransaction?: boolean
    bankAccountDetailsDefined?: boolean
    /** Whether `isPeerActuallyUser` was true — proxied via `isVerified`
     *  when input has `isVerified=true` (since isPeerActuallyUser gates
     *  the `isVerified` output). */
    isPeerActuallyUser?: boolean
    cardPaymentDefined?: boolean
}

interface TestCase {
    name: string
    entry: HistoryEntry
    expect: ExpectedShape
}

const cases: TestCase[] = [
    // ───── DIRECT_SEND ─────
    {
        name: 'DIRECT_SEND × SENDER → outgoing send to user',
        entry: baseEntry({
            type: EHistoryEntryType.DIRECT_SEND,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
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
        name: 'DIRECT_SEND × RECIPIENT → incoming receive from user',
        entry: baseEntry({
            type: EHistoryEntryType.DIRECT_SEND,
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            isVerified: true,
        }),
        expect: { direction: 'receive', transactionCardType: 'receive', userName: 'bob', isPeerActuallyUser: true },
    },

    // ───── SEND_LINK ─────
    {
        name: 'SEND_LINK × SENDER (claimed by peanut user) → send to claimer username',
        entry: baseEntry({
            type: EHistoryEntryType.SEND_LINK,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
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
        name: 'SEND_LINK × SENDER (unclaimed) → still send via link, no peer',
        entry: baseEntry({
            type: EHistoryEntryType.SEND_LINK,
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.PENDING,
            recipientAccount: { ...externalEoa },
            isVerified: true,
        }),
        expect: { direction: 'send', transactionCardType: 'send', isPeerActuallyUser: false, isLinkTransaction: true },
    },
    {
        name: 'SEND_LINK × RECIPIENT (claimed by external addr) → claim_external',
        entry: baseEntry({
            type: EHistoryEntryType.SEND_LINK,
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: externalEoa,
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
            type: EHistoryEntryType.SEND_LINK,
            userRole: EHistoryUserRole.BOTH,
            recipientAccount: aliceUser,
        }),
        expect: { isLinkTransaction: true },
    },

    // ───── BRIDGE_OFFRAMP ─────
    {
        name: 'BRIDGE_OFFRAMP → bank_withdraw with bankAccountDetails populated',
        entry: baseEntry({
            type: EHistoryEntryType.BRIDGE_OFFRAMP,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: ibanAccountES,
        }),
        expect: {
            direction: 'bank_withdraw',
            transactionCardType: 'bank_withdraw',
            userName: 'Bank Account',
            bankAccountDetailsDefined: true,
        },
    },

    // ───── MANTECA_OFFRAMP — bankAccountDetails plumbed (legacy bug fixed in PR-B) ─────
    {
        name: 'MANTECA_OFFRAMP → bank_withdraw with bankAccountDetails populated (post-PR-B)',
        entry: baseEntry({
            type: EHistoryEntryType.MANTECA_OFFRAMP,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: ibanAccountES,
        }),
        expect: { direction: 'bank_withdraw', transactionCardType: 'bank_withdraw', bankAccountDetailsDefined: true },
    },

    // ───── BRIDGE_ONRAMP / MANTECA_ONRAMP ─────
    {
        name: 'BRIDGE_ONRAMP → bank_deposit',
        entry: baseEntry({
            type: EHistoryEntryType.BRIDGE_ONRAMP,
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
        }),
        expect: { direction: 'bank_deposit', transactionCardType: 'bank_deposit', userName: 'Bank Account' },
    },
    {
        name: 'MANTECA_ONRAMP → bank_deposit',
        entry: baseEntry({
            type: EHistoryEntryType.MANTECA_ONRAMP,
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
        }),
        expect: { direction: 'bank_deposit', transactionCardType: 'bank_deposit', userName: 'Bank Account' },
    },

    // ───── DEPOSIT (CRYPTO_DEPOSIT legacy) ─────
    {
        name: 'DEPOSIT regular → add, with sender identifier (legacy: never marks peer as user)',
        entry: baseEntry({
            type: EHistoryEntryType.DEPOSIT,
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            isVerified: true,
        }),
        // Legacy DEPOSIT case sets isPeerActuallyUser=false even when sender is a user.
        // PR-B's TRANSACTION_INTENT/CRYPTO_DEPOSIT branch will improve on this; legacy stays as-is.
        expect: {
            direction: 'add',
            transactionCardType: 'add',
            userName: bobUser.identifier,
            isPeerActuallyUser: false,
        },
    },
    {
        name: 'DEPOSIT zero-amount test transaction → "Enjoy Peanut!"',
        entry: baseEntry({
            type: EHistoryEntryType.DEPOSIT,
            userRole: EHistoryUserRole.RECIPIENT,
            amount: '0',
            recipientAccount: aliceUser,
        }),
        expect: { direction: 'add', transactionCardType: 'add', userName: 'Enjoy Peanut!' },
    },

    // ───── QR PAYMENTS ─────
    {
        name: 'MANTECA_QR_PAYMENT → qr_payment / pay',
        entry: baseEntry({
            type: EHistoryEntryType.MANTECA_QR_PAYMENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: { identifier: 'merchant-xyz', type: 'MERCHANT', isUser: false },
        }),
        expect: { direction: 'qr_payment', transactionCardType: 'pay', userName: 'merchant-xyz' },
    },

    // ───── PERK_REWARD ─────
    {
        name: 'PERK_REWARD → receive Peanut Reward',
        entry: baseEntry({
            type: EHistoryEntryType.PERK_REWARD,
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
        }),
        expect: { direction: 'receive', transactionCardType: 'receive', userName: 'Peanut Reward' },
    },

    // ═════════════════════════════════════════════════════════════════════
    // TRANSACTION_INTENT — current state (some passing, some failing today)
    // ═════════════════════════════════════════════════════════════════════

    {
        name: 'TRANSACTION_INTENT × P2P_SEND × SENDER → outgoing send',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
            extraData: { kind: 'P2P_SEND' },
            isVerified: true,
        }),
        expect: { direction: 'send', transactionCardType: 'send', userName: 'alice', isPeerActuallyUser: true },
    },
    {
        name: 'TRANSACTION_INTENT × P2P_SEND × RECIPIENT → incoming receive (already patched in playtest)',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            extraData: { kind: 'P2P_SEND' },
            isVerified: true,
        }),
        expect: { direction: 'receive', transactionCardType: 'receive', userName: 'bob', isPeerActuallyUser: true },
    },
    {
        name: 'TRANSACTION_INTENT × QR_PAY → qr_payment to merchant',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: { identifier: 'merchant-xyz', type: 'MERCHANT', isUser: false },
            extraData: { kind: 'QR_PAY' },
        }),
        expect: { direction: 'qr_payment', transactionCardType: 'pay', userName: 'merchant-xyz' },
    },
    {
        name: 'TRANSACTION_INTENT × LINK_CREATE × SENDER → "Sent via link"',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: externalEoa,
            extraData: { kind: 'LINK_CREATE' },
        }),
        expect: { direction: 'send', transactionCardType: 'send', userName: 'Sent via link', isLinkTransaction: true },
    },
    {
        name: 'TRANSACTION_INTENT × CRYPTO_WITHDRAW × SENDER → withdraw to external account',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: externalEoa,
            extraData: { kind: 'CRYPTO_WITHDRAW' },
        }),
        expect: { direction: 'withdraw', transactionCardType: 'withdraw', userName: externalEoa.identifier },
    },
    {
        name: 'TRANSACTION_INTENT × CRYPTO_WITHDRAW × RECIPIENT → add (already patched in playtest)',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
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
    {
        name: 'TRANSACTION_INTENT × FIAT_OFFRAMP × SENDER → bank_withdraw',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: ibanAccountES,
            extraData: { kind: 'FIAT_OFFRAMP' },
        }),
        expect: { direction: 'bank_withdraw', transactionCardType: 'bank_withdraw', userName: 'Bank Account' },
    },
    {
        name: 'TRANSACTION_INTENT × CARD_SPEND with merchant → qr_payment / pay',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
            extraData: { kind: 'CARD_SPEND', merchantName: 'Acme Coffee', rainTransactionId: 'rain-123' },
        }),
        expect: {
            direction: 'qr_payment',
            transactionCardType: 'pay',
            userName: 'Acme Coffee',
            cardPaymentDefined: true,
        },
    },
    {
        name: 'TRANSACTION_INTENT × CARD_SPEND with no merchant → fallback "Card payment"',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: aliceUser,
            extraData: { kind: 'CARD_SPEND' },
        }),
        expect: {
            direction: 'qr_payment',
            transactionCardType: 'pay',
            userName: 'Card payment',
            cardPaymentDefined: true,
        },
    },
    {
        name: 'TRANSACTION_INTENT × OTHER + parentRainTxId → card refund',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.RECIPIENT,
            recipientAccount: aliceUser,
            extraData: { kind: 'OTHER', parentRainTxId: 'rain-456', merchantName: 'Acme Coffee' },
        }),
        expect: {
            direction: 'receive',
            transactionCardType: 'receive',
            userName: 'Refund from Acme Coffee',
            cardPaymentDefined: true,
        },
    },

    // ═════════════════════════════════════════════════════════════════════
    // KNOWN BUGS — these tests SHOULD PASS after PR-B; today they FAIL
    // ═════════════════════════════════════════════════════════════════════

    {
        name: '[PR-B] TRANSACTION_INTENT × CRYPTO_DEPOSIT → add (currently misroutes to default=send)',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            extraData: { kind: 'CRYPTO_DEPOSIT' },
            isVerified: true,
        }),
        expect: { direction: 'add', transactionCardType: 'add', userName: 'bob', isPeerActuallyUser: true },
    },
    {
        name: '[PR-B] TRANSACTION_INTENT × LINK_CREATE × RECIPIENT (claimed by user) → receive from claimer (currently always "Sent via link")',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.RECIPIENT,
            senderAccount: bobUser,
            recipientAccount: aliceUser,
            extraData: { kind: 'LINK_CREATE' },
            isVerified: true,
        }),
        expect: { direction: 'receive', transactionCardType: 'receive', userName: 'bob', isPeerActuallyUser: true },
    },
    {
        name: '[PR-B] TRANSACTION_INTENT × FIAT_OFFRAMP plumbs bankAccountDetails for the country flag',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: ibanAccountES,
            extraData: { kind: 'FIAT_OFFRAMP' },
        }),
        expect: { bankAccountDetailsDefined: true },
    },
    {
        name: '[PR-B] TRANSACTION_INTENT × CRYPTO_WITHDRAW plumbs bankAccountDetails when recipient is IBAN',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: ibanAccountES,
            extraData: { kind: 'CRYPTO_WITHDRAW' },
        }),
        expect: { bankAccountDetailsDefined: true },
    },
    {
        name: '[PR-B] MANTECA_OFFRAMP plumbs bankAccountDetails (independent legacy bug)',
        entry: baseEntry({
            type: EHistoryEntryType.MANTECA_OFFRAMP,
            userRole: EHistoryUserRole.SENDER,
            recipientAccount: ibanAccountES,
        }),
        expect: { bankAccountDetailsDefined: true },
    },

    // ─── PR-D: reaper-failed copy ─────────────────────────────────────────
    {
        name: '[PR-D] reaper-failed P2P_SEND (failReason=p2p_send_timeout) renders user-friendly copy',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.FAILED,
            recipientAccount: aliceUser,
            extraData: { kind: 'P2P_SEND', failReason: 'p2p_send_timeout' },
        }),
        expect: { userName: "Send didn't complete" },
    },
    {
        name: '[PR-D] reaper-failed OFFRAMP renders bank-transfer copy',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.FAILED,
            recipientAccount: ibanAccountES,
            extraData: { kind: 'FIAT_OFFRAMP', failReason: 'offramp_timeout' },
        }),
        expect: { userName: "Bank transfer didn't complete" },
    },
    {
        name: '[PR-D] non-reaper FAILED (no _timeout suffix) keeps original userName',
        entry: baseEntry({
            type: EHistoryEntryType.TRANSACTION_INTENT,
            userRole: EHistoryUserRole.SENDER,
            status: EHistoryStatus.FAILED,
            recipientAccount: aliceUser,
            extraData: { kind: 'P2P_SEND', failReason: 'validator_max_retries' },
        }),
        // Falls through — userName remains 'alice' from the kind=P2P_SEND branch.
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

    describe('TRANSACTION_INTENT default arm (forward-compat / regression guard)', () => {
        it('renders an unhandled kind as something explicit, not silent fallthrough', () => {
            const entry = baseEntry({
                type: EHistoryEntryType.TRANSACTION_INTENT,
                userRole: EHistoryUserRole.SENDER,
                recipientAccount: aliceUser,
                extraData: { kind: 'SOMETHING_NEW_THAT_BACKEND_ADDED' },
            })
            const result = mapTransactionDataForDrawer(entry).transactionDetails
            // Today: direction='send', userName=alice's identifier (since it's the recipient).
            // After PR-B's assertNever + Sentry breadcrumb, this should still produce a rendering
            // (defensive rendering) but log the unknown kind. Asserting the rendering survives.
            expect(result.direction).toBeDefined()
            expect(result.extraDataForDrawer?.kind).toBe('SOMETHING_NEW_THAT_BACKEND_ADDED')
        })
    })
})
