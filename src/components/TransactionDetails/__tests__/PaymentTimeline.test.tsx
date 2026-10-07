import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { loadMessages } from '@/i18n/app/messages'
import { renderWithIntl } from '@/test-utils/intl'
import { PaymentReceiptTabs, PaymentTimeline } from '../PaymentTimeline'
import type { TransactionDetails } from '../transactionTransformer'

const transaction: TransactionDetails = {
    id: 'test',
    direction: 'send',
    userName: 'Alex',
    fullName: 'Alex',
    initials: 'A',
    amount: 10,
    date: '2026-10-07T10:00:00Z',
    createdAt: '2026-10-07T10:00:00Z',
    status: 'processing',
    intentStatus: 'PROCESSING',
    totalAmountCollected: 0,
}

it('opens Updates and lets the user access the existing details', () => {
    renderWithIntl(<PaymentReceiptTabs transaction={transaction} details={<p>Bank details</p>} />)
    expect(screen.getByRole('tab', { name: 'Updates' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Bank details')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Payment timeline' })).toBeInTheDocument()
    expect(screen.getByText('Payment processing').closest('li')).toHaveAttribute('aria-current', 'step')
    // Unknown processing time is not replaced by the creation timestamp.
    expect(screen.getByText('Payment processing').closest('li')!.querySelector('time')).toBeNull()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Details' }), { button: 0, ctrlKey: false })
    expect(screen.getByText('Bank details')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

it('resets to Updates when a different payment is opened', () => {
    const { rerender } = renderWithIntl(<PaymentReceiptTabs transaction={transaction} details="Bank details" />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Details' }), { button: 0, ctrlKey: false })
    rerender(<PaymentReceiptTabs transaction={{ ...transaction, id: 'other' }} details="Other details" />)
    expect(screen.getByRole('tab', { name: 'Updates' })).toHaveAttribute('aria-selected', 'true')
})

it('keeps the active step current while rendering the inactive final milestone', () => {
    renderWithIntl(<PaymentReceiptTabs transaction={transaction} details="Bank details" />)
    const active = screen.getByText('Payment processing').closest('li')!
    const final = screen.getByText('Payment complete').closest('li')!
    expect(active).toHaveAttribute('aria-current', 'step')
    expect(screen.queryByText('Current status')).not.toBeInTheDocument()
    expect(active.querySelector('.bg-background-icon-bubble-yellow')).not.toBeNull()
    expect(final).toHaveAttribute('data-state', 'upcoming')
    expect(final).not.toHaveAttribute('aria-current')
    expect(final.querySelector('time')).toBeNull()
    expect(final.querySelector('.bg-background-icon-bubble-gray')).not.toBeNull()
})

it.each([{ isPublic: true }, { transaction: { ...transaction, isRequestPotLink: true } }])(
    'keeps shared receipts and request pots as details',
    (props) => {
        renderWithIntl(<PaymentReceiptTabs transaction={transaction} details="Bank details" {...props} />)
        expect(screen.getByText('Bank details')).toBeInTheDocument()
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    }
)

it.each([
    ['en', 'Payment refunded'],
    ['es-419', 'Pago reembolsado'],
    ['es-AR', 'Pago reembolsado'],
    ['pt-BR', 'Pagamento reembolsado'],
] as const)('renders translated timeline copy in %s, including delta-catalog fallback', async (locale, label) => {
    const messages = await loadMessages(locale)
    render(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <PaymentTimeline
                steps={[
                    { step: 'failed', time: '2026-10-07T10:01:00Z' },
                    { step: 'refunded', time: '2026-10-07T10:02:00Z' },
                ]}
            />
        </NextIntlClientProvider>
    )
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(document.querySelectorAll('time[datetime]')).toHaveLength(2)
})
