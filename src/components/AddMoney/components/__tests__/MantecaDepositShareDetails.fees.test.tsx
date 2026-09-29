/**
 * The Manteca deposit details itemize only what is charged on top: the network
 * cost of moving the funds. Manteca's conversion cost is inside its rate, so
 * there is no separate Peanut fee row to call sponsored.
 */
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import MantecaDepositShareDetails from '../MantecaDepositShareDetails'

jest.mock('next/navigation', () => ({ useParams: () => ({ country: 'argentina' }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: ({ label, value, moreInfoText }: { label: string; value: string; moreInfoText?: string }) => (
        <p data-testid="row" data-more-info={moreInfoText}>
            {label}: {value}
        </p>
    ),
}))

const deposit = {
    details: {
        depositAddresses: {},
        depositAddress: '0000003100010000000001',
        depositAlias: 'peanut.alias',
        withdrawCostInAgainst: '0.03',
        withdrawCostInAsset: '0.03',
        price: '1200',
    },
    stages: {
        '1': { thresholdAmount: '12000', asset: 'ARS' },
        '3': { amount: '10' },
    },
} as unknown as MantecaDepositResponseData

it('shows the rate with its included cost, itemizes the network cost, and has no Peanut fee row', () => {
    renderWithIntl(<MantecaDepositShareDetails depositDetails={deposit} onBack={jest.fn()} />)
    const rows = screen.getAllByTestId('row')

    const rate = rows.find((row) => row.textContent?.startsWith('Exchange rate'))
    expect(rate).toHaveTextContent('1 USD = 1200 ARS')
    expect(rate).toHaveAttribute('data-more-info', 'Includes the conversion cost.')

    expect(rows.find((row) => row.textContent?.startsWith('Provider fees'))).toHaveTextContent('0.03 USD')

    expect(rows.map((row) => row.textContent).join('\n')).not.toMatch(/Peanut fee|Sponsored/i)
})
