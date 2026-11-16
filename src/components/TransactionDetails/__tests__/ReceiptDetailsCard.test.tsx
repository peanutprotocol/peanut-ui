// What the details card prints for the rows the view model turns on — the
// labels and values a user reads, after consolidation.
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReceiptDetailsCard } from '../ReceiptDetailsCard'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({ useOptionalAuth: () => null }))
jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))
const mockCopy = jest.fn(async (_text: string) => true)
jest.mock('@/utils/clipboard.utils', () => ({ copyTextToClipboard: (text: string) => mockCopy(text) }))

// rendered without a parent drawer, as on a receipt page
function Card({ transaction, isPublic = false }: { transaction: TransactionDetails; isPublic?: boolean }) {
    const vm = useReceiptViewModel(transaction, { isPublic, surface: 'page' })
    return (
        <QueryClientProvider client={new QueryClient()}>
            <ToastProvider>
                <ReceiptDetailsCard transaction={transaction} vm={vm} shouldShowQrShare={false} />
            </ToastProvider>
        </QueryClientProvider>
    )
}

const vaDeposit = (overrides: Record<string, unknown> = {}, drawer: Record<string, unknown> = {}) =>
    ({
        id: 'dep-1',
        direction: 'bank_deposit',
        userName: 'Bank account',
        fullName: '',
        initials: 'BA',
        amount: 24.32,
        tokenSymbol: 'USDC',
        status: 'completed',
        date: '2026-09-10T10:00:00Z',
        createdAt: '2026-09-10T09:00:00Z',
        completedAt: '2026-09-10T10:00:00Z',
        currency: { code: 'EUR', amount: '21.33' },
        extraDataForDrawer: {
            originalType: 'TRANSACTION_INTENT',
            originalUserRole: EHistoryUserRole.RECIPIENT,
            kind: 'ONRAMP',
            isDepositAccountDeposit: true,
            receipt: { exchange_rate: '0.8769' },
            ...drawer,
        },
        ...overrides,
    }) as unknown as TransactionDetails

describe("ReceiptDetailsCard — deposit into the user's bank details", () => {
    it('names the payer in a From row', () => {
        renderWithIntl(<Card transaction={vaDeposit({}, { payerName: 'Ana Pérez' })} />)
        expect(screen.getByText('From')).toBeInTheDocument()
        expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    })

    it('says the name was not provided instead of dropping the row', () => {
        renderWithIntl(<Card transaction={vaDeposit()} />)
        expect(screen.getByText('Bank transfer (name not provided)')).toBeInTheDocument()
    })

    it('shows the payer note as plain text under "Sender\'s note"', () => {
        renderWithIntl(<Card transaction={vaDeposit({}, { senderReference: '<b>INVOICE</b> 4471' })} />)
        expect(screen.getByText("Sender's note")).toBeInTheDocument()
        expect(screen.getByText('<b>INVOICE</b> 4471')).toBeInTheDocument()
    })

    it('prints a settled conversion once, with the rate, and no estimate', () => {
        renderWithIntl(<Card transaction={vaDeposit()} />)
        expect(screen.getByText('Converted')).toBeInTheDocument()
        expect(screen.getByText('EUR 21.33 → 24.32 USD')).toBeInTheDocument()
        expect(screen.getByText('1 USD = EUR 0.88')).toBeInTheDocument()
        expect(screen.queryByText('Estimate conversion')).not.toBeInTheDocument()
        expect(screen.queryByText('Exchange rate')).not.toBeInTheDocument()
    })

    // Aleks, 2026-11-13: a deposit sent back was never converted; the same value reads as its rate
    it.each([
        ['refunded', { status: 'refunded', actionLabelKey: 'type.returnedToSender' }, {}],
        ['returned after it failed', { status: 'failed' }, { wasReturned: true }],
    ])('states a %s deposit at its exchange rate, in one row, never as converted', (_case, overrides, drawer) => {
        renderWithIntl(<Card transaction={vaDeposit(overrides, drawer)} />)
        expect(screen.getAllByText('Exchange rate')).toHaveLength(1)
        // the value as the receipt prints it today, signed as the returned money (staging: "1.73 USD → BRL 10")
        expect(screen.getByText('24.32 USD → EUR 21.33')).toBeInTheDocument()
        expect(screen.getByText('1 USD = EUR 0.88')).toBeInTheDocument()
        expect(screen.queryByText('Converted')).not.toBeInTheDocument()
        expect(screen.queryByText('Estimate conversion')).not.toBeInTheDocument()
    })

    // a completed Pix deposit: R$10 in, 1.76 USDC out, the rate in reais per dollar
    it('keeps a completed Pix deposit as converted, with its rate line', () => {
        const pix = vaDeposit(
            { amount: 1.76, currency: { code: 'BRL', amount: '10.00' } },
            { receipt: { exchange_rate: '5.681818' } }
        )
        renderWithIntl(<Card transaction={pix} />)
        expect(screen.getByText('Converted')).toBeInTheDocument()
        expect(screen.getByText('BRL 10 → 1.76 USD')).toBeInTheDocument()
        expect(screen.getByText('1 USD = BRL 5.68')).toBeInTheDocument()
        expect(screen.queryByText('Exchange rate')).not.toBeInTheDocument()
    })

    // The first real R$20 deposit through Avenia (15 Nov) under TASK-24967: the rate under Converted
    // holds the conversion and gas fees, the flat In Fee is the row. (20.00 − 0.75) ÷ 5.796567 = 3.32 USD.
    it('shows a settled Avenia deposit’s rate under Converted, and the flat fee as the Provider fee row', () => {
        const avenia = vaDeposit(
            { amount: 3.320931, currency: { code: 'BRL', amount: '20.00' } },
            { provider: 'AVENIA', receipt: { exchange_rate: '5.796567' }, providerFeeBrl: '0.75' }
        )
        renderWithIntl(<Card transaction={avenia} />)
        expect(screen.getByText('BRL 20 → 3.32 USD')).toBeInTheDocument()
        expect(screen.getByText('1 USD = BRL 5.80')).toBeInTheDocument()
        expect(screen.getByText('Provider fee')).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
    })

    it('shows no fee row without the rate beside it (the API sends both or neither)', () => {
        const feeAlone = vaDeposit(
            { amount: 3.320931, currency: { code: 'BRL', amount: '20.00' } },
            { provider: 'AVENIA', receipt: undefined, providerFeeBrl: '0.75' }
        )
        renderWithIntl(<Card transaction={feeAlone} />)
        expect(screen.queryByText('Provider fee')).not.toBeInTheDocument()
        expect(screen.queryByText(/^1 USD =/)).not.toBeInTheDocument()
    })

    // QA 2026-09-24 (QA-08): one word for the returned state, on the badge and the date row
    it('dates a returned deposit as Returned, never Refunded', () => {
        renderWithIntl(
            <Card transaction={vaDeposit({ status: 'refunded', actionLabelKey: 'type.returnedToSender' })} />
        )
        expect(screen.getByText('Returned')).toBeInTheDocument()
        expect(screen.queryByText('Refunded')).not.toBeInTheDocument()
    })

    it('keeps the estimate wording only while pending', () => {
        renderWithIntl(<Card transaction={vaDeposit({ status: 'pending', completedAt: undefined })} />)
        expect(screen.getByText('Estimate conversion')).toBeInTheDocument()
        expect(screen.getByText('≈ EUR 21.33')).toBeInTheDocument()
        expect(screen.getByText('Exchange rate')).toBeInTheDocument()
        expect(screen.queryByText('Converted')).not.toBeInTheDocument()
    })
})

describe('ReceiptDetailsCard — token rows', () => {
    it('never prints a Token amount row, even on a cancelled non-stable withdraw', () => {
        const tokenDetails = { tokenSymbol: 'ETH', chainName: 'Base', tokenIcon: 'x', chainIconUrl: '' }
        renderWithIntl(
            <Card
                transaction={vaDeposit(
                    {
                        direction: 'withdraw',
                        status: 'cancelled',
                        tokenSymbol: 'ETH',
                        tokenAmount: '0.0041',
                        currency: undefined,
                        sourceView: 'history',
                        tokenDisplayDetails: tokenDetails,
                    },
                    { kind: 'CRYPTO_WITHDRAW', isDepositAccountDeposit: undefined }
                )}
            />
        )
        expect(screen.queryByText('Token amount')).not.toBeInTheDocument()
        expect(screen.queryByText('24.32')).not.toBeInTheDocument()
    })
})

describe('ReceiptDetailsCard — dates and document rows', () => {
    it('prints Created and Completed, never "Issued on" or a receipt reference', () => {
        renderWithIntl(<Card transaction={vaDeposit()} />)
        expect(screen.getByText('Created')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.queryByText('Issued on')).not.toBeInTheDocument()
        expect(screen.queryByText('Receipt reference')).not.toBeInTheDocument()
        expect(screen.queryByText('dep-1')).not.toBeInTheDocument()
    })

    it('prints one Cancelled row on a cancelled receipt', () => {
        renderWithIntl(
            <Card
                transaction={vaDeposit({
                    status: 'cancelled',
                    completedAt: undefined,
                    cancelledDate: '2026-09-11T08:00:00Z',
                })}
            />
        )
        expect(screen.getByText('Created')).toBeInTheDocument()
        expect(screen.getAllByText('Cancelled')).toHaveLength(1)
        expect(screen.queryByText('Completed')).not.toBeInTheDocument()
    })
})

describe('ReceiptDetailsCard — the provider row (TASK-23295)', () => {
    const mantecaQr = () =>
        vaDeposit(
            {
                id: 'qr-1',
                direction: 'qr_payment',
                userName: 'Merchant',
                fee: 0,
                currency: { code: 'ARS', amount: '1000' },
            },
            { kind: 'QR_PAY', provider: 'MANTECA', isDepositAccountDeposit: false, receipt: undefined }
        )

    it('names the provider after the fee rows, with a (?) that opens the sheet', () => {
        renderWithIntl(<Card transaction={mantecaQr()} />)
        expect(screen.getByText('Provider')).toBeInTheDocument()
        expect(screen.getByText('Manteca')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'About Manteca' })).toBeInTheDocument()
        const fee = screen.getByText('Fee')
        expect(fee.compareDocumentPosition(screen.getByText('Manteca')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('prints no provider row when no provider moved the money', () => {
        renderWithIntl(<Card transaction={vaDeposit()} />)
        expect(screen.queryByText('Provider')).not.toBeInTheDocument()
    })
})

describe('ReceiptDetailsCard — network fee (TASK-23487)', () => {
    const withdraw = (networkFeeDetails: Record<string, unknown>, recipientReceivesUsd?: number) =>
        vaDeposit(
            {
                direction: 'withdraw',
                userName: '0x1f9a04c7d',
                amount: 64.5,
                currency: undefined,
                sourceView: 'status',
                networkFeeDetails,
                recipientReceivesUsd,
            },
            {
                kind: 'CRYPTO_WITHDRAW',
                originalUserRole: EHistoryUserRole.SENDER,
                isDepositAccountDeposit: undefined,
                receipt: undefined,
            }
        )

    it('prints Pending while the fee settles', () => {
        renderWithIntl(<Card transaction={withdraw({ state: 'pending' })} />)
        expect(screen.getByText('Network fee')).toBeInTheDocument()
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.queryByText('Recipient receives')).not.toBeInTheDocument()
    })

    it('prints the quote as an estimate while the fee settles', () => {
        renderWithIntl(<Card transaction={withdraw({ state: 'pending', amountDisplay: '$1.43' })} />)
        expect(screen.getByText('≈ $1.43')).toBeInTheDocument()
        expect(screen.queryByText('Pending')).not.toBeInTheDocument()
        expect(screen.queryByText('Recipient receives')).not.toBeInTheDocument()
    })

    it('prints Sponsored by Peanut! for a settled zero fee', () => {
        renderWithIntl(<Card transaction={withdraw({ state: 'sponsored' })} />)
        expect(screen.getByText('Network fee')).toBeInTheDocument()
        expect(screen.getByText('Sponsored by Peanut!')).toBeInTheDocument()
    })

    it('prints the charged fee and what the recipient received, never a $0 placeholder', () => {
        renderWithIntl(<Card transaction={withdraw({ state: 'charged', amountDisplay: '$1.43' }, 63.067329)} />)
        expect(screen.getByText('Network fee')).toBeInTheDocument()
        expect(screen.getByText('$1.43')).toBeInTheDocument()
        expect(screen.getByText('Recipient receives')).toBeInTheDocument()
        expect(screen.getByText('$63.07')).toBeInTheDocument()
        expect(screen.queryByText('$0')).not.toBeInTheDocument()
        const fee = screen.getByText('Network fee')
        expect(
            fee.compareDocumentPosition(screen.getByText('Recipient receives')) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })
})

// Aleks, 2026-11-14 (TASK-24947): a Pix payout names its account "Pix key", prints a CPF, CNPJ or
// phone key punctuated, and the copy button copies the key itself
describe('ReceiptDetailsCard — the Pix key a payout paid', () => {
    const pixPayout = (identifier: string, type = 'pix') =>
        ({
            id: 'wd-1',
            direction: 'bank_withdraw',
            userName: 'Bank account',
            fullName: '',
            initials: 'BA',
            amount: 18.87,
            tokenSymbol: 'USDC',
            status: 'completed',
            date: '2026-11-14T10:00:00Z',
            createdAt: '2026-11-14T10:00:00Z',
            completedAt: '2026-11-14T10:04:00Z',
            currency: { code: 'BRL', amount: '100.00' },
            bankAccountDetails: { identifier, type },
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.SENDER,
                kind: 'OFFRAMP',
                provider: 'AVENIA',
            },
        }) as unknown as TransactionDetails

    it.each([
        ['a CPF', '11144477735', '111.444.777-35'],
        ['a phone', '+5511987654321', '11 98765-4321'],
        ['a CNPJ', '12345678000195', '12.345.678/0001-95'],
        ['an email', 'ana.souza@example.com', 'ana.souza@example.com'],
    ])('labels %s key "Pix key" and prints it as %s', (_kind, key, shown) => {
        renderWithIntl(<Card transaction={pixPayout(key)} />)
        expect(screen.getByText('Pix key')).toBeInTheDocument()
        expect(screen.getByText(shown)).toBeInTheDocument()
        expect(screen.queryByText('Account number')).not.toBeInTheDocument()
    })

    // review finding 8: a payout to another person's key reads as a send and keeps its Transfer ID
    it("keeps the Transfer ID on a payout to another person's key", () => {
        renderWithIntl(<Card transaction={{ ...pixPayout('+5511987654321'), direction: 'send' }} />)
        expect(screen.getByText('Transfer ID')).toBeInTheDocument()
    })

    it.each([
        ['a phone', '+5511987654321', '11 98765-4321'],
        // an email read as an IBAN would come out upper case
        ['an email', 'ana.souza@example.com', 'ana.souza@example.com'],
    ])('copies %s key itself, never the printed form', async (_kind, key, shown) => {
        renderWithIntl(<Card transaction={pixPayout(key, 'BANK_PIX')} />)
        const row = screen.getByText(shown).parentElement!
        fireEvent.click(row.querySelector('button')!)
        await waitFor(() => expect(mockCopy).toHaveBeenCalledWith(key))
    })
})
