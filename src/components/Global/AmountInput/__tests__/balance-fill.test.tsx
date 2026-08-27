import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '@/components/Global/AmountInput'

/**
 * Tapping the balance row fills the whole spendable amount (TASK-21899).
 * The point of these tests is that the filled amount comes from the exact
 * number the parent validates against, not from the rounded label next to it.
 */

// USDC, as the withdraw amount screen configures it
const USDC = { symbol: '$', price: 1, decimals: 6 }

function setup(props: Partial<React.ComponentProps<typeof AmountInput>> = {}) {
    const setPrimaryAmount = jest.fn()
    renderWithIntl(
        <AmountInput
            setPrimaryAmount={setPrimaryAmount}
            primaryDenomination={USDC}
            hideCurrencyToggle
            walletBalance="12.35"
            balanceFillAmount={12.345678}
            {...props}
        />
    )
    const field = screen.getByRole('textbox') as HTMLInputElement
    return {
        setPrimaryAmount,
        field,
        useFullBalance: () => screen.queryByRole('button', { name: /use full balance/i }),
        lastReported: () => setPrimaryAmount.mock.lastCall?.[0],
    }
}

describe('AmountInput full-balance fill', () => {
    it('fills the exact balance rather than the rounded label', () => {
        const { field, useFullBalance, lastReported } = setup()

        fireEvent.click(useFullBalance()!)

        expect(field.value).toBe('12.345678')
        expect(lastReported()).toBe('12.345678')
    })

    it('truncates to the denomination precision instead of rounding above the balance', () => {
        const { field, useFullBalance } = setup({ balanceFillAmount: 12.3456789 })

        fireEvent.click(useFullBalance()!)

        expect(Number(field.value)).toBeLessThanOrEqual(12.3456789)
        expect(field.value).toBe('12.345678')
    })

    it('honours a two-decimal denomination', () => {
        const { field, useFullBalance } = setup({
            primaryDenomination: { symbol: '$', price: 1, decimals: 2 },
            balanceFillAmount: 12.345678,
        })

        fireEvent.click(useFullBalance()!)

        expect(field.value).toBe('12.34')
    })

    it('keeps the balance plain text when there is nothing to withdraw', () => {
        const { field, useFullBalance, setPrimaryAmount } = setup({
            walletBalance: '0.00',
            balanceFillAmount: 0,
        })

        expect(useFullBalance()).toBeNull()
        expect(screen.getByText(/Balance:/)).toBeInTheDocument()
        expect(field.value).toBe('')
        expect(setPrimaryAmount).not.toHaveBeenCalledWith(expect.stringMatching(/[1-9]/))
    })

    it('keeps the balance plain text when it is smaller than the input can express', () => {
        const { field, useFullBalance } = setup({
            primaryDenomination: { symbol: '$', price: 1, decimals: 2 },
            walletBalance: '0.00',
            balanceFillAmount: 0.004,
        })

        expect(useFullBalance()).toBeNull()
        expect(field.value).toBe('')
    })

    it('restores the full balance after a manual edit', () => {
        const { field, useFullBalance, lastReported } = setup()

        fireEvent.click(useFullBalance()!)
        fireEvent.change(field, { target: { value: '5' } })
        expect(lastReported()).toBe('5')

        fireEvent.click(useFullBalance()!)

        expect(field.value).toBe('12.345678')
        expect(lastReported()).toBe('12.345678')
    })

    it('does not offer the fill while the input is disabled', () => {
        const { useFullBalance } = setup({ disabled: true })

        expect(useFullBalance()).toBeNull()
    })
})
