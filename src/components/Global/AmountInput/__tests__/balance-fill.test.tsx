import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '@/components/Global/AmountInput'

/**
 * Tapping the balance amount fills the whole spendable amount (TASK-21899).
 * The point of these tests is that the fill is floored to cents and can never
 * exceed the balance — the user is never told they can withdraw more than
 * they hold, and the fill matches the label, which truncates the same way.
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
            walletBalance="12.34"
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
    it('fills the balance floored to cents', () => {
        const { field, useFullBalance, lastReported } = setup()

        fireEvent.click(useFullBalance()!)

        expect(field.value).toBe('12.34')
        expect(lastReported()).toBe('12.34')
    })

    it('rounds down, never up, so the fill cannot exceed the balance', () => {
        // 10.126123 must become 10.12, not 10.13 — the 0.006123 stays behind.
        const { field, useFullBalance } = setup({ walletBalance: '10.12', balanceFillAmount: 10.126123 })

        fireEvent.click(useFullBalance()!)

        expect(field.value).toBe('10.12')
        expect(Number(field.value)).toBeLessThanOrEqual(10.126123)
    })

    it('stays at cents even when the field accepts more decimals', () => {
        // The withdraw screen runs this input at 6 decimals so a user CAN type
        // them; the fill still stops at the two the balance label shows.
        const { field, useFullBalance } = setup({
            primaryDenomination: { symbol: '$', price: 1, decimals: 6 },
            balanceFillAmount: 12.345678,
        })

        fireEvent.click(useFullBalance()!)

        expect(field.value).toBe('12.34')
    })

    it('does not fill more decimals than a coarse denomination holds', () => {
        const { field, useFullBalance } = setup({
            primaryDenomination: { symbol: '$', price: 1, decimals: 0 },
            balanceFillAmount: 12.345678,
        })

        fireEvent.click(useFullBalance()!)

        expect(field.value).toBe('12')
    })

    it('makes only the amount tappable, not the word Balance', () => {
        const { useFullBalance } = setup()

        expect(useFullBalance()).toHaveTextContent('$12.34')
        expect(useFullBalance()).not.toHaveTextContent(/Balance/)
        expect(screen.getByText('Balance:')).toBeInTheDocument()
    })

    it('writes the symbol against the number, and an ISO code apart from it', () => {
        const { unmount } = renderWithIntl(
            <AmountInput setPrimaryAmount={jest.fn()} primaryDenomination={USDC} walletBalance="12.34" />
        )
        expect(screen.getByText('Balance: $12.34')).toBeInTheDocument()
        unmount()

        renderWithIntl(
            <AmountInput
                setPrimaryAmount={jest.fn()}
                primaryDenomination={USDC}
                secondaryDenomination={{ symbol: 'ARS', price: 0.001, decimals: 2 }}
                walletBalance="12.34"
            />
        )
        expect(screen.getByText('Balance: USD 12.34')).toBeInTheDocument()
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

    it('keeps the balance plain text when it is smaller than a cent', () => {
        const { field, useFullBalance } = setup({
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

        expect(field.value).toBe('12.34')
        expect(lastReported()).toBe('12.34')
    })

    it('does not open the keyboard over the CTA when filling', () => {
        // The form wrapper focuses the field on any click inside it; the fill
        // button must not ride that path.
        const { field, useFullBalance } = setup()
        field.blur()

        fireEvent.click(useFullBalance()!)

        expect(document.activeElement).not.toBe(field)
        expect(field.value).toBe('12.34')
    })

    it('reports the fill separately, so the parent can tell it from typing', () => {
        const onBalanceFilled = jest.fn()
        const { field, useFullBalance } = setup({ onBalanceFilled })

        fireEvent.click(useFullBalance()!)
        expect(onBalanceFilled).toHaveBeenCalledWith('12.34')

        onBalanceFilled.mockClear()
        fireEvent.change(field, { target: { value: '5' } })
        expect(onBalanceFilled).not.toHaveBeenCalled()
    })

    it('does not offer the fill while the input is disabled', () => {
        const { useFullBalance } = setup({ disabled: true })

        expect(useFullBalance()).toBeNull()
    })
})
