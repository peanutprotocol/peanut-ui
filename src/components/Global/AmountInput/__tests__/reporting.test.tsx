import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '..'

// TASK-23054: callers pass the denominations as object literals. Reporting the
// amount again on every parent render wrote the URL each time when the setter
// was a URL state, and in Next.js that discarded the withdraw Continue navigation.
test('a parent re-render with the same denominations reports nothing new', () => {
    const primary = jest.fn()
    const secondary = jest.fn()
    const field = (price: number) => (
        <AmountInput
            primaryDenomination={{ symbol: 'EUR', price, decimals: 2 }}
            secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
            setPrimaryAmount={primary}
            setSecondaryAmount={secondary}
        />
    )
    const { rerender } = renderWithIntl(field(0.875))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '5' } })
    expect(primary).toHaveBeenLastCalledWith('5')
    expect(secondary).toHaveBeenLastCalledWith('5.71')
    const reports = primary.mock.calls.length

    rerender(field(0.875))
    expect(primary).toHaveBeenCalledTimes(reports)

    // a new rate is a real change: the converted amount is reported again
    rerender(field(0.8))
    expect(secondary).toHaveBeenLastCalledWith('6.25')
})
