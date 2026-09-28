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

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

function Card({ transaction, isPublic = false }: { transaction: TransactionDetails; isPublic?: boolean }) {
    const vm = useReceiptViewModel(transaction, { isPublic })
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

    it('states a refunded deposit as converted, not as an estimate', () => {
        renderWithIntl(<Card transaction={vaDeposit({ status: 'refunded' })} />)
        expect(screen.getByText('Converted')).toBeInTheDocument()
        expect(screen.queryByText('Estimate conversion')).not.toBeInTheDocument()
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
