/**
 * Every Pix transaction leads with the Pix logo in Activity, by method, not by provider; the user's
 * own Pix deposit and withdrawal are titled "Pix" (owner's ruling, 2026-11-15, TASK-24947).
 *
 * The entries are shaped as `GET /users/history` sends them (peanut-api-ts
 * src/transaction-intent/history.ts `mapGenericIntent` for Avenia, src/manteca/history.ts for
 * Manteca): an Avenia payout's other side is the user's Avenia wallet, an address, never a Pix
 * account, so only `extraData` says the money moved by Pix. The earlier rule passed on fixtures
 * that carried a Pix account and failed on these.
 */
import React from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import TransactionCard from '../TransactionCard'
import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { isPixEntry } from '../pix-entry'
import { getAvatarUrl, type HistoryEntry, type HistoryEntryExtraData } from '@/utils/history.utils'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }) }))
jest.mock('../TransactionDetailsDrawer', () => ({ TransactionDetailsDrawer: () => null }))
jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '/mercado-pago.svg', PIX: '/pix.svg' }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

const WALLET = { identifier: '0x1111111111111111111111111111111111111111', type: 'peanut-wallet', isUser: true }
// mapGenericIntent's counterparty on an Avenia intent: the user's Avenia wallet (metadata.recipient)
const AVENIA_WALLET = { identifier: '0x7b3f9a1c2d4e5f60718293a4b5c6d7e8f9012345', type: 'address', isUser: false }
const PIX = { paymentMethod: 'PIX' }

let nextId = 0
const entry = (
    over: Partial<HistoryEntry> & { extraData: HistoryEntryExtraData; status?: HistoryEntry['status'] }
): HistoryEntry =>
    ({
        uuid: `entry-${++nextId}`,
        type: 'TRANSACTION_INTENT',
        timestamp: new Date('2026-11-15T12:00:00.000Z'),
        amount: '18.87',
        currency: { amount: '100.00', code: 'BRL' },
        tokenSymbol: 'USDC',
        chainId: '42161',
        status: 'COMPLETED',
        ...over,
    }) as HistoryEntry

const aveniaDeposit = (extra: HistoryEntryExtraData = PIX, status: HistoryEntry['status'] = 'COMPLETED') =>
    entry({
        status,
        userRole: 'RECIPIENT',
        senderAccount: AVENIA_WALLET,
        recipientAccount: WALLET,
        extraData: {
            kind: 'ONRAMP',
            provider: 'AVENIA',
            pixDeposit: { codePayable: false, expiresAt: null },
            ...extra,
        },
    } as never)

const aveniaPayout = (
    ownAccount: boolean,
    extra: HistoryEntryExtraData = PIX,
    status: HistoryEntry['status'] = 'COMPLETED'
) =>
    entry({
        status,
        userRole: 'SENDER',
        senderAccount: WALLET,
        recipientAccount: AVENIA_WALLET,
        extraData: {
            kind: 'OFFRAMP',
            provider: 'AVENIA',
            pixRecovery: null,
            pixPayout: {
                pixKey: '+5511987654321',
                holderName: ownAccount ? 'Ana Souza' : 'Bruno Lima',
                bankName: 'Nubank',
                ownAccount,
            },
            ...extra,
        },
    } as never)

const aveniaQr = (extra: HistoryEntryExtraData = PIX, status: HistoryEntry['status'] = 'COMPLETED') =>
    entry({
        status,
        userRole: 'SENDER',
        senderAccount: WALLET,
        recipientAccount: { identifier: 'PADARIA', type: 'BANK_CBU', isUser: false },
        extraData: { kind: 'QR_PAY', provider: 'AVENIA', pixRecovery: null, ...extra },
    } as never)

const mantecaDeposit = (code: string, extra: HistoryEntryExtraData = PIX) =>
    entry({
        currency: { amount: '100.00', code },
        userRole: 'RECIPIENT',
        senderAccount: { identifier: 'Manteca Deposit', type: 'BANK_CBU', isUser: false },
        recipientAccount: WALLET,
        extraData: { kind: 'ONRAMP', provider: 'MANTECA', isRefund: false, receipt: {}, ...extra },
    } as never)

const mantecaWithdrawal = (
    code: string,
    extra: HistoryEntryExtraData = PIX,
    status: HistoryEntry['status'] = 'COMPLETED'
) =>
    entry({
        status,
        currency: { amount: '100.00', code },
        userRole: 'SENDER',
        senderAccount: WALLET,
        recipientAccount: { identifier: '09579927189', type: 'BANK_CBU', isUser: false },
        extraData: { kind: 'OFFRAMP', provider: 'MANTECA', isRefund: false, receipt: {}, ...extra },
    } as never)

const mantecaQr = (code: string, recipient: Record<string, unknown>, extra: HistoryEntryExtraData = PIX) =>
    entry({
        currency: { amount: '51.30', code },
        userRole: 'SENDER',
        senderAccount: WALLET,
        recipientAccount: { type: 'BANK_CBU', isUser: false, ...recipient },
        extraData: { kind: 'QR_PAY', provider: 'MANTECA', isRefund: false, receipt: {}, ...extra },
    } as never)

const renderRow = (wire: HistoryEntry) => {
    const { transactionDetails, transactionCardType } = mapTransactionDataForDrawer(wire)
    return rtlRender(
        <TransactionCard
            type={transactionCardType}
            name={transactionDetails.userName}
            amount={Number(transactionDetails.amount)}
            status={transactionDetails.status}
            initials={transactionDetails.initials}
            transaction={transactionDetails}
            isSelected={false}
            onOpen={jest.fn()}
            onClose={jest.fn()}
        />,
        { wrapper: IntlWrapper }
    )
}

const leadingLogo = (container: HTMLElement) => container.querySelector('img')?.getAttribute('src') ?? null

describe('Activity: a Pix transaction leads with the Pix logo, through either provider', () => {
    it.each<[string, HistoryEntry, string, string]>([
        ['an Avenia deposit', aveniaDeposit(), 'Pix', 'Add'],
        ['an Avenia withdrawal to the own key', aveniaPayout(true), 'Pix', 'Withdraw'],
        ["an Avenia send to another person's key", aveniaPayout(false), 'Bruno Lima', 'Send'],
        ['an Avenia QR payment', aveniaQr(), 'Padaria', 'Pay'],
        ['a Manteca deposit', mantecaDeposit('BRL'), 'Pix', 'Add'],
        ['a Manteca withdrawal', mantecaWithdrawal('BRL'), 'Pix', 'Withdraw'],
        [
            "a Manteca send to a person's key",
            mantecaQr('BRL', { identifier: 'maria@silva.com.br', fullName: 'MARIA DA SILVA' }),
            'Maria Da Silva',
            'Send',
        ],
        ['a Manteca QR payment', mantecaQr('BRL', { identifier: 'PADARIA' }), 'Padaria', 'Pay'],
    ])('%s: the Pix logo, its title and its verb', (_, wire, title, verb) => {
        const { container } = renderRow(wire)
        expect(leadingLogo(container)).toBe('/pix.svg')
        expect(screen.getByText(title)).toBeInTheDocument()
        expect(screen.getByText(verb)).toBeInTheDocument()
    })

    it.each<[string, HistoryEntry]>([
        ['a pending deposit', aveniaDeposit(PIX, 'PENDING')],
        ['a failed withdrawal', aveniaPayout(true, PIX, 'FAILED')],
        ['a refunded send', aveniaPayout(false, PIX, 'REFUNDED')],
        ['a refunded QR payment', aveniaQr(PIX, 'REFUNDED')],
        ['a pending Manteca withdrawal', mantecaWithdrawal('BRL', PIX, 'PENDING')],
    ])('%s keeps the Pix logo', (_, wire) => {
        expect(leadingLogo(renderRow(wire).container)).toBe('/pix.svg')
    })

    it('the receipt header reads the same logo as the row', () => {
        for (const wire of [aveniaDeposit(), aveniaPayout(true), aveniaPayout(false), aveniaQr()]) {
            expect(getAvatarUrl(mapTransactionDataForDrawer(wire).transactionDetails)).toBe('/pix.svg')
        }
    })
})

// An API without `paymentMethod`: the Pix-only fields carry the rule; the currency never does.
describe('isPixEntry without paymentMethod', () => {
    const none = {}
    it.each<[string, HistoryEntry]>([
        ['an Avenia deposit (pixDeposit)', aveniaDeposit(none)],
        ['an Avenia withdrawal (pixRecovery, pixPayout)', aveniaPayout(true, none)],
        ['an Avenia send (pixPayout)', aveniaPayout(false, none)],
        ['an Avenia QR payment (pixRecovery)', aveniaQr(none)],
        ['a Manteca Pix QR payment (its QR rail)', mantecaQr('BRL', { identifier: 'PADARIA' }, none)],
        [
            'a payout to a Pix account',
            entry({
                userRole: 'SENDER',
                recipientAccount: { identifier: '+5511987654321', type: 'pix', isUser: false },
                extraData: { kind: 'OFFRAMP', provider: 'BRIDGE' },
            } as never),
        ],
    ])('%s is Pix', (_, wire) => {
        expect(isPixEntry(wire)).toBe(true)
    })

    it.each<[string, HistoryEntry]>([
        ['a Manteca BRL deposit', mantecaDeposit('BRL', none)],
        ['a Manteca BRL withdrawal', mantecaWithdrawal('BRL', none)],
    ])('%s is not Pix by its currency alone', (_, wire) => {
        expect(isPixEntry(wire)).toBe(false)
        const { container } = renderRow(wire)
        expect(leadingLogo(container)).not.toBe('/pix.svg')
        expect(screen.getByText('Bank account')).toBeInTheDocument()
    })
})

describe('Activity: rows that are not Pix do not change', () => {
    it('a Mercado Pago payment keeps the Mercado Pago logo', () => {
        const { container } = renderRow(mantecaQr('ARS', { identifier: 'KIOSCO' }, {}))
        expect(leadingLogo(container)).toBe('/mercado-pago.svg')
    })

    it.each<[string, HistoryEntry]>([
        ['an ARS withdrawal', mantecaWithdrawal('ARS', {})],
        ['an ARS deposit', mantecaDeposit('ARS', {})],
        [
            'a SEPA withdrawal',
            entry({
                currency: { amount: '20', code: 'EUR' },
                userRole: 'SENDER',
                senderAccount: WALLET,
                recipientAccount: { identifier: 'ES2700750984220607080217', type: 'BANK_IBAN', isUser: false },
                extraData: { kind: 'OFFRAMP', provider: 'BRIDGE' },
            } as never),
        ],
        [
            'a card payment',
            entry({
                currency: { amount: '20', code: 'USD' },
                userRole: 'SENDER',
                senderAccount: WALLET,
                recipientAccount: { identifier: 'Coffee', type: 'merchant', isUser: false },
                extraData: { kind: 'CARD_SPEND_CLEAR', provider: 'RAIN', merchantName: 'Coffee' },
            } as never),
        ],
        [
            'a crypto withdrawal',
            entry({
                currency: { amount: '20', code: 'USD' },
                userRole: 'SENDER',
                senderAccount: WALLET,
                recipientAccount: {
                    identifier: '0x2222222222222222222222222222222222222222',
                    type: 'address',
                    isUser: false,
                },
                extraData: { kind: 'CRYPTO_WITHDRAW', provider: 'RHINO' },
            } as never),
        ],
        [
            'a Peanut-to-Peanut send',
            entry({
                currency: { amount: '20', code: 'USD' },
                userRole: 'SENDER',
                senderAccount: WALLET,
                recipientAccount: {
                    identifier: '0x3333333333333333333333333333333333333333',
                    type: 'peanut-wallet',
                    isUser: true,
                    username: 'bob',
                },
                extraData: { kind: 'DIRECT_TRANSFER', provider: 'PEANUT' },
            } as never),
        ],
    ])('%s has no Pix logo', (_, wire) => {
        expect(isPixEntry(wire)).toBe(false)
        expect(leadingLogo(renderRow(wire).container)).not.toBe('/pix.svg')
    })

    it('an ARS withdrawal keeps "Bank account"', () => {
        renderRow(mantecaWithdrawal('ARS', {}))
        expect(screen.getByText('Bank account')).toBeInTheDocument()
    })
})
