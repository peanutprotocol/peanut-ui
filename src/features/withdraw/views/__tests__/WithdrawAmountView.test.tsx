import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { WithdrawAmountView } from '../WithdrawAmountView'

// TASK-23054: a bank account paid in EUR, GBP, MXN or COP takes the bank
// amount in that currency; the USD it converts to at the quote rate is what
// the amount checks run on.
function setup(bankRate?: number) {
    const onAmountChange = jest.fn()
    const onDestinationAmountChange = jest.fn()
    const onBalanceFilled = jest.fn()
    const onDenominationChange = jest.fn()
    renderWithIntl(
        <WithdrawAmountView
            pageTitle="Withdraw"
            heading="Amount to withdraw"
            initialAmount=""
            walletBalance="500.00"
            balanceFillAmount={100.009}
            onBalanceFilled={onBalanceFilled}
            onAmountChange={onAmountChange}
            onBack={() => {}}
            onContinue={() => {}}
            continueDisabled={false}
            error={{ showError: false, errorMessage: '' }}
            isCryptoWithdraw={false}
            bankAmount={
                bankRate
                    ? {
                          currency: 'EUR',
                          rate: bankRate,
                          initialAmount: '',
                          initialDenomination: 'EUR',
                          onAmountChange: onDestinationAmountChange,
                          onDenominationChange,
                      }
                    : undefined
            }
        />
    )
    const field = screen.getByRole('textbox') as HTMLInputElement
    return { field, onAmountChange, onDestinationAmountChange, onBalanceFilled, onDenominationChange }
}

describe('WithdrawAmountView — bank amount typed in its currency (TASK-23054)', () => {
    it('opens in the bank currency, not USD', () => {
        setup(0.9)
        expect(screen.getByText('EUR')).toBeInTheDocument()
    })

    it('reports the toggle to USD, so a USD amount is handed on as USD', () => {
        const { field, onDenominationChange } = setup(0.9)
        expect(onDenominationChange).toHaveBeenLastCalledWith('EUR')
        fireEvent.change(field, { target: { value: '90' } })
        fireEvent.click(screen.getByRole('button', { name: /switch currency/i }))
        expect(onDenominationChange).toHaveBeenLastCalledWith('USD')
    })

    it('stores the typed bank amount and reports the USD it converts to', () => {
        const { field, onAmountChange, onDestinationAmountChange } = setup(0.9)
        fireEvent.change(field, { target: { value: '900' } })
        expect(onDestinationAmountChange).toHaveBeenLastCalledWith('900')
        // 900 EUR at 0.9 EUR per USD = 1000 USD
        expect(Number(onAmountChange.mock.lastCall?.[0])).toBeCloseTo(1000, 2)
    })

    it('fills the balance in the bank currency from the USD balance floored to cents', () => {
        // 100.009 USD floors to 100.00, at 0.9 EUR per USD → 90 EUR, never above the balance
        const { field, onBalanceFilled } = setup(0.9)
        fireEvent.click(screen.getByRole('button', { name: /use full balance/i }))
        expect(field.value).toBe('90')
        expect(onBalanceFilled).toHaveBeenCalledWith('90')
    })
})

describe('WithdrawAmountView — USD amount (unchanged)', () => {
    it('has no bank currency and reports the typed amount as USD', () => {
        const { field, onAmountChange } = setup()
        expect(screen.queryByText('EUR')).not.toBeInTheDocument()
        fireEvent.change(field, { target: { value: '42' } })
        expect(onAmountChange.mock.lastCall?.[0]).toBe('42')
    })
})
