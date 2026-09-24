import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { TransactionDetails } from '../transactionTransformer'
import { PerkRewardReceipt } from '../provider-receipts/PerkRewardReceipt'

describe('PerkRewardReceipt actions', () => {
    test('renders the common receipt action stack for perk rewards', () => {
        const transaction = {
            id: 'perk-1',
            date: '2026-09-12T11:21:00.000Z',
            status: 'completed',
            extraDataForDrawer: { kind: 'PERK_REWARD' },
        } as unknown as TransactionDetails

        render(
            <IntlWrapper>
                <PerkRewardReceipt
                    transaction={transaction}
                    perkRewardData={{ reason: 'Cashback reward', discountPercentage: 2 }}
                    amountDisplay="$2.00"
                    actions={<div data-testid="receipt-actions" />}
                />
            </IntlWrapper>
        )

        expect(screen.getByTestId('receipt-actions')).toBeInTheDocument()
        expect(screen.getByText('Sep 12, 2026')).toBeInTheDocument()
        expect(screen.getByText('11:21')).toBeInTheDocument()
    })
})

describe('PerkRewardReceipt status badge', () => {
    const renderWithStatus = (status: string) =>
        render(
            <IntlWrapper>
                <PerkRewardReceipt
                    transaction={
                        {
                            id: 'perk-1',
                            date: '2026-09-12T11:21:00.000Z',
                            status,
                            extraDataForDrawer: { kind: 'PERK_REWARD' },
                        } as unknown as TransactionDetails
                    }
                    perkRewardData={{ reason: 'Cashback reward', discountPercentage: 2 }}
                    amountDisplay="$2.00"
                    actions={null}
                />
            </IntlWrapper>
        )

    // design.md badges: in progress on our side is processing (info blue), not attention yellow
    test.each(['pending', 'processing'])('a %s reward reads Processing in info blue', (status) => {
        renderWithStatus(status)
        expect(screen.getByText('Processing')).toHaveClass('bg-background-badge-info')
    })

    test('a failed reward reads in error red', () => {
        renderWithStatus('failed')
        expect(screen.getByText('Failed')).toHaveClass('bg-background-badge-error')
    })

    test('a completed reward shows no badge', () => {
        renderWithStatus('completed')
        expect(screen.queryByText('Completed')).not.toBeInTheDocument()
    })
})
