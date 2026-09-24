import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { WithdrawAmountView } from '../WithdrawAmountView'

// QA-49: withdrawing to a EUR/GBP/MXN bank account must ask for the amount in
// that currency, not USD — the destination currency is primary, USD (the
// exact amount actually sent) is the derived secondary value.
function setup(overrides: { destinationCurrency?: string; destinationRate?: string | null } = {}) {
    const onAmountChange = jest.fn()
    const onBalanceFilled = jest.fn()
    renderWithIntl(
        <WithdrawAmountView
            pageTitle="Withdraw"
            heading="Amount to withdraw"
            initialAmount=""
            walletBalance="500.00"
            balanceFillAmount={100}
            onBalanceFilled={onBalanceFilled}
            onAmountChange={onAmountChange}
            onBack={() => {}}
            onContinue={() => {}}
            continueDisabled={false}
            error={{ showError: false, errorMessage: '' }}
            isCryptoWithdraw={false}
            destinationCurrency={overrides.destinationCurrency}
            destinationRate={overrides.destinationRate}
        />
    )
    const field = screen.getByRole('textbox') as HTMLInputElement
    return { field, onAmountChange, onBalanceFilled }
}

describe('WithdrawAmountView — EUR/GBP/MXN destination (QA-49)', () => {
    it('opens with the destination currency, not USD', () => {
        setup({ destinationCurrency: 'EUR', destinationRate: '0.9' })
        expect(screen.getByText('EUR')).toBeInTheDocument()
    })

    it('reports the amount actually sent as USD, converted from the typed destination amount', () => {
        // Bridge sell_rate convention: local-currency units per 1 USD.
        const { field, onAmountChange } = setup({ destinationCurrency: 'EUR', destinationRate: '0.9' })
        fireEvent.change(field, { target: { value: '900' } })
        // 900 EUR / 0.9 (EUR per USD) = 1000 USD
        expect(Number(onAmountChange.mock.lastCall?.[0])).toBeCloseTo(1000, 2)
    })

    it('converts the USD spendable balance into the destination currency for the balance-fill row', () => {
        // balanceFillAmount=100 USD, rate=0.9 EUR/USD -> fills 90 EUR (the
        // primary/typed unit), not 100 (which would be the raw USD figure)
        const { field, onBalanceFilled } = setup({ destinationCurrency: 'EUR', destinationRate: '0.9' })
        fireEvent.click(screen.getByRole('button', { name: /use full balance/i }))
        expect(field.value).toBe('90')
        expect(onBalanceFilled).toHaveBeenCalledWith('90')
    })
})

describe('WithdrawAmountView — USD destination (unchanged behavior)', () => {
    it('has no destination-currency label and reports the typed amount directly as USD', () => {
        const { field, onAmountChange } = setup()
        expect(screen.queryByText('EUR')).not.toBeInTheDocument()
        fireEvent.change(field, { target: { value: '42' } })
        expect(onAmountChange.mock.lastCall?.[0]).toBe('42')
    })
})
