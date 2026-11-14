// What the details card prints for the rows the view model turns on — the
// labels and values a user reads, after consolidation.
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReceiptDetailsCard } from '../ReceiptDetailsCard'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import en from '@/i18n/app/messages/en.json'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({ useOptionalAuth: () => null }))
jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

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
        expect(screen.getByText('1 USD = EUR 0.8769')).toBeInTheDocument()
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
        expect(screen.getByText('1 USD = EUR 0.8769')).toBeInTheDocument()
        expect(screen.queryByText('Converted')).not.toBeInTheDocument()
        expect(screen.queryByText('Estimate conversion')).not.toBeInTheDocument()
    })

    // the first Bridge Pix deposit, 13 Nov: R$10 in, 1.76 USDC out, the rate in reais per dollar
    it('keeps a completed Pix deposit as converted, with its rate line', () => {
        const pix = vaDeposit(
            { amount: 1.76, currency: { code: 'BRL', amount: '10.00' } },
            { receipt: { exchange_rate: '5.681818' } }
        )
        renderWithIntl(<Card transaction={pix} />)
        expect(screen.getByText('Converted')).toBeInTheDocument()
        expect(screen.getByText('BRL 10 → 1.76 USD')).toBeInTheDocument()
        expect(screen.getByText('1 USD = BRL 5.6818')).toBeInTheDocument()
        expect(screen.queryByText('Exchange rate')).not.toBeInTheDocument()
    })

    // Aleks, 2026-11-13: a Pix deposit's reference is its end-to-end id, never "Reference we sent"
    it.each([
        ['completed', {}],
        ['returned', { status: 'refunded', actionLabelKey: 'type.returnedToSender' }],
    ])("labels a %s Pix deposit's end-to-end id as E2E ID, copyable", (_case, overrides) => {
        const e2e = 'E00416968202611131908aBcD1234567'
        renderWithIntl(<Card transaction={vaDeposit(overrides, { isPixDeposit: true, paymentReference: e2e })} />)
        expect(screen.getByText('E2E ID')).toBeInTheDocument()
        expect(screen.getByText(e2e)).toBeInTheDocument()
        expect(screen.queryByText('Reference we sent')).not.toBeInTheDocument()
    })

    it('keeps "Reference we sent" on a deposit that did not come by Pix', () => {
        renderWithIntl(<Card transaction={vaDeposit({}, { paymentReference: 'REF-4471' })} />)
        expect(screen.getByText('Reference we sent')).toBeInTheDocument()
        expect(screen.queryByText('E2E ID')).not.toBeInTheDocument()
    })

    it('shows the E2E ID to the owner only, as every payment reference', () => {
        renderWithIntl(
            <Card transaction={vaDeposit({}, { isPixDeposit: true, paymentReference: 'E0041696820261113' })} isPublic />
        )
        expect(screen.queryByText('E2E ID')).not.toBeInTheDocument()
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

describe('ReceiptDetailsCard — the account a payout paid', () => {
    const payout = (provider: string, type: string, identifier: string, currency: string) =>
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
            currency: { code: currency, amount: '100.00' },
            bankAccountDetails: { identifier, type },
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.SENDER,
                kind: 'OFFRAMP',
                provider,
            },
        }) as unknown as TransactionDetails

    it('names a Pix key a Pix key on a Bridge payout', () => {
        renderWithIntl(<Card transaction={payout('BRIDGE', 'BANK_PIX', 'ana.souza@example.com', 'brl')} />)
        expect(screen.getByText('Pix key')).toBeInTheDocument()
        expect(screen.getByText('ana.souza@example.com')).toBeInTheDocument()
        expect(screen.queryByText('Account number')).not.toBeInTheDocument()
    })

    it('names a Pix key a Pix key on a Manteca payout in reais, whose account reads as a CBU', () => {
        renderWithIntl(<Card transaction={payout('MANTECA', 'BANK_CBU', '+5511912345678', 'BRL')} />)
        expect(screen.getByText('Pix key')).toBeInTheDocument()
        expect(screen.queryByText('Account number')).not.toBeInTheDocument()
    })

    it('keeps Account number on a Manteca payout in pesos', () => {
        renderWithIntl(<Card transaction={payout('MANTECA', 'BANK_CBU', '0000003100010000000001', 'ARS')} />)
        expect(screen.getByText('Account number')).toBeInTheDocument()
        expect(screen.queryByText('Pix key')).not.toBeInTheDocument()
    })
})

// TASK-24910, API-CONTRACT 8.3: on Bridge's Pix the rate row is the market rate and a "Provider fee" row
// says what Bridge kept, so the rows add up to the reais the receipt shows
describe("ReceiptDetailsCard — the provider fee of Bridge's Pix", () => {
    const FEE_ROWS = { marketRate: '5.72', providerFee: { amount: '0.63', currency: 'BRL' } }
    // the work order's example: $20.00 at 5.72 is R$114.40, less R$0.63 is R$113.77
    const payout = (overrides: Record<string, unknown> = {}, drawer: Record<string, unknown> = FEE_ROWS) =>
        ({
            id: 'wd-1',
            direction: 'bank_withdraw',
            userName: 'Bank account',
            fullName: '',
            initials: 'BA',
            amount: 20,
            tokenSymbol: 'USDC',
            status: 'completed',
            date: '2026-11-14T10:00:00Z',
            createdAt: '2026-11-14T10:00:00Z',
            completedAt: '2026-11-14T10:04:00Z',
            currency: { code: 'BRL', amount: '113.77' },
            bankAccountDetails: { identifier: 'ana.souza@example.com', type: 'BANK_PIX' },
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.SENDER,
                kind: 'OFFRAMP',
                provider: 'BRIDGE',
                ...drawer,
            },
            ...overrides,
        }) as unknown as TransactionDetails

    it('states the market rate and the provider fee on a paid payout, and they add up to the reais', () => {
        renderWithIntl(<Card transaction={payout()} />)
        expect(screen.getByText('20 USD → BRL 113.77')).toBeInTheDocument()
        expect(screen.getByText('1 USD = BRL 5.72')).toBeInTheDocument()
        expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
        expect(screen.getByText('BRL 0.63')).toBeInTheDocument()
        expect(Math.round((20 * 5.72 - 0.63) * 100) / 100).toBe(113.77)
    })

    // R$10.00 paid, 1.73 USDC received: 1.73 × 5.746 + 0.06 = R$10.00
    it('states them on a deposit too, the fee added to what arrived', () => {
        const deposit = vaDeposit(
            { amount: 1.73, currency: { code: 'BRL', amount: '10.00' } },
            {
                receipt: { exchange_rate: '5.780346' },
                marketRate: '5.7471',
                providerFee: { amount: '0.06', currency: 'BRL' },
            }
        )
        renderWithIntl(<Card transaction={deposit} />)
        expect(screen.getByText('1 USD = BRL 5.746')).toBeInTheDocument()
        expect(screen.getByText('BRL 0.06')).toBeInTheDocument()
        expect(screen.queryByText('1 USD = BRL 5.7803')).not.toBeInTheDocument()
    })

    // ruling 14 Nov: a pending Bridge payout's reais are blank, so the rows could not add up on screen
    it('shows neither row while the receipt shows no reais', () => {
        renderWithIntl(<Card transaction={payout({ status: 'pending', currency: { code: 'BRL', amount: '' } })} />)
        expect(screen.queryByText(en.pix.withdraw.fee)).not.toBeInTheDocument()
        expect(screen.queryByText('1 USD = BRL 5.72')).not.toBeInTheDocument()
    })

    // a Pix deposit in reais, sent back: the API sends no fee rows for it, and the app shows none either way
    const returnedDeposit = vaDeposit(
        {
            status: 'refunded',
            actionLabelKey: 'type.returnedToSender',
            amount: 1.73,
            currency: { code: 'BRL', amount: '10.00' },
        },
        { ...FEE_ROWS, receipt: { exchange_rate: '5.780346' } }
    )

    it.each([
        ['a returned deposit', returnedDeposit],
        ['a returned payout', payout({ status: 'failed' }, { ...FEE_ROWS, wasReturned: true })],
    ])('shows no provider fee on %s, which converted nothing', (_case, transaction) => {
        renderWithIntl(<Card transaction={transaction} />)
        expect(screen.queryByText(en.pix.withdraw.fee)).not.toBeInTheDocument()
    })

    it('keeps the returned deposit\'s "Exchange rate" row and its own rate', () => {
        renderWithIntl(<Card transaction={returnedDeposit} />)
        expect(screen.getAllByText('Exchange rate')).toHaveLength(1)
        expect(screen.getByText('1 USD = BRL 5.7803')).toBeInTheDocument()
    })

    // Manteca's route, or a Bridge entry without a recorded rate: the receipt as it is today
    it('shows no provider fee row without the fields', () => {
        renderWithIntl(<Card transaction={payout({}, {})} />)
        expect(screen.getByText('20 USD → BRL 113.77')).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.fee)).not.toBeInTheDocument()
    })
})
