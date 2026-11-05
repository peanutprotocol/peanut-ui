import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '..'

function setup(amount: string) {
    const primary = jest.fn()
    const secondary = jest.fn()
    renderWithIntl(
        <AmountInput
            primaryDenomination={{ symbol: 'BRL', price: 1, decimals: 2 }}
            secondaryDenomination={{ symbol: 'USD', price: 0.18, decimals: 2 }}
            setPrimaryAmount={primary}
            setSecondaryAmount={secondary}
        />
    )
    const field = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(field, { target: { value: amount } })
    fireEvent.click(screen.getByRole('button', { name: /switch currency/i }))
    return { field, primary, secondary }
}

test('a sub-cent USD conversion leaves an editable keypad', () => {
    const { field } = setup('0.05')
    expect(field.value).toBe('0')
    fireEvent.change(field, { target: { value: field.value + '1' } })
    expect(Number(field.value)).toBe(1)
})

test('an ignored extra decimal after conversion does not requantize the amount', () => {
    const { field, primary } = setup('9.99')
    const before = primary.mock.lastCall?.[0]
    fireEvent.change(field, { target: { value: field.value + '9' } })
    expect(primary.mock.lastCall?.[0]).toBe(before)
})

test('retains the primary amount when its conversion rounds to zero and through a round trip', () => {
    const { field, primary, secondary } = setup('0.05')
    expect(field.value).toBe('0')
    expect(Number(primary.mock.lastCall?.[0])).toBe(0.05)
    expect(Number(secondary.mock.lastCall?.[0])).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: /switch currency/i }))
    expect(Number(field.value)).toBe(0.05)
    expect(Number(primary.mock.lastCall?.[0])).toBe(0.05)
})

test('typing reports the denomination typed in; the toggle itself reports nothing (TASK-23997)', () => {
    const onAmountTyped = jest.fn()
    renderWithIntl(
        <AmountInput
            primaryDenomination={{ symbol: 'BRL', price: 1, decimals: 2 }}
            secondaryDenomination={{ symbol: 'USD', price: 0.18, decimals: 2 }}
            setPrimaryAmount={jest.fn()}
            setSecondaryAmount={jest.fn()}
            onAmountTyped={onAmountTyped}
        />
    )
    const field = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(field, { target: { value: '100' } })
    expect(onAmountTyped).toHaveBeenLastCalledWith('BRL')

    fireEvent.click(screen.getByRole('button', { name: /switch currency/i }))
    expect(onAmountTyped).toHaveBeenCalledTimes(1)

    fireEvent.change(field, { target: { value: '20' } })
    expect(onAmountTyped).toHaveBeenLastCalledWith('USD')
})
