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
    })
})
