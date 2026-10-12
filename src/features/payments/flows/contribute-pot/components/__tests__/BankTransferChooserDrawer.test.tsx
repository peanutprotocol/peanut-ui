import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { BankTransferChooserDrawer } from '../BankTransferChooserDrawer'

const mockLeaf = jest.fn()
jest.mock('../PayByBankTransferDrawer', () => ({
    PayByBankTransferDrawer: (props: {
        rail: { railId: string; payerAmount: { currency: string } }
        nested: boolean
    }) => {
        mockLeaf(props)
        return <button>{`Pay in ${props.rail.payerAmount.currency}`}</button>
    },
}))

const rail = (currency: string, railId: string) => ({
    kind: 'bank' as const,
    railId,
    reference: 'request-reference',
    payerAmount: { amount: '100.00', currency, isEstimate: false },
})

it('opens one chooser with requester context and the eligible rails in order', () => {
    render(
        <IntlWrapper>
            <BankTransferChooserDrawer
                requestId="req-1"
                rails={[rail('EUR', 'bridge.sepa_eu'), rail('USD', 'bridge.ach_us'), rail('GBP', 'bridge.fps_gb')]}
                recipientUsername="hugo"
                recipientAvatarKey={null}
                requestMessage="Dinner in Berlin"
                requestAmount="100.00 EUR"
                bankRowProps={{ bankPayable: true, remainingUsd: 108 }}
                onUnavailable={jest.fn()}
            />
        </IntlWrapper>
    )

    expect(screen.queryByText('Pay in EUR')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('bank-transfer-chooser'))

    expect(screen.getByText('Choose a currency')).toBeInTheDocument()
    expect(screen.getByText('@hugo')).toBeInTheDocument()
    expect(screen.getByText('Dinner in Berlin')).toBeInTheDocument()
    expect(screen.getByText('100.00 EUR')).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
        'Pay in EUR',
        'Pay in USD',
        'Pay in GBP',
    ])
    expect(mockLeaf).toHaveBeenCalledWith(
        expect.objectContaining({
            requestId: 'req-1',
            nested: true,
            requestContext: expect.objectContaining({
                recipientUsername: 'hugo',
                requestMessage: 'Dinner in Berlin',
                requestAmount: '100.00 EUR',
            }),
        })
    )
})

it('wraps the row description instead of cutting it', () => {
    render(
        <IntlWrapper>
            <BankTransferChooserDrawer
                requestId="req-1"
                rails={[rail('EUR', 'bridge.sepa_eu')]}
                recipientUsername="hugo"
                recipientAvatarKey={null}
                bankRowProps={{ bankPayable: true, remainingUsd: 108 }}
                onUnavailable={jest.fn()}
            />
        </IntlWrapper>
    )

    const description = screen.getByText("Send from your bank to the requester's account.")
    expect(description).not.toHaveClass('truncate')
    expect(description).toHaveClass('whitespace-normal')
})
