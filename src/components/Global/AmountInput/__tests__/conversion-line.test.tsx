import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '..'

// EUR per USD, the sell rate the withdraw quote returned in the TASK-23054 QA walk
const EUR = { symbol: 'EUR', price: 0.8955, decimals: 2 }
const USD = { symbol: 'USD', price: 1, decimals: 2 }

// The review charged $11.17 for €10 while the amount step said "≈ USD 11.16":
// the quote rounds the USDC up to the cent, and the field floored it.
test('with roundSecondaryUp the USD line and the reported amount round up like the quote', () => {
    const secondary = jest.fn()
    renderWithIntl(
        <AmountInput
            primaryDenomination={EUR}
            secondaryDenomination={USD}
            roundSecondaryUp
            setPrimaryAmount={jest.fn()}
            setSecondaryAmount={secondary}
        />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10' } })
    expect(screen.getByText('≈ USD 11.17')).toBeInTheDocument()
    // the balance check runs on this value, so it matches what the review charges
    expect(secondary).toHaveBeenLastCalledWith('11.17')
})

test('an exact cent is not rounded up by float residue', () => {
    const secondary = jest.fn()
    renderWithIntl(
        <AmountInput
            primaryDenomination={{ symbol: 'EUR', price: 0.8, decimals: 2 }}
            secondaryDenomination={USD}
            roundSecondaryUp
            setPrimaryAmount={jest.fn()}
            setSecondaryAmount={secondary}
        />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '100' } })
    expect(secondary).toHaveBeenLastCalledWith('125')
    expect(screen.getByText('≈ USD 125')).toBeInTheDocument()
})

test('without roundSecondaryUp the conversion still floors', () => {
    const secondary = jest.fn()
    renderWithIntl(
        <AmountInput
            primaryDenomination={EUR}
            secondaryDenomination={USD}
            setPrimaryAmount={jest.fn()}
            setSecondaryAmount={secondary}
        />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10' } })
    expect(secondary).toHaveBeenLastCalledWith('11.16')
})

// "≈ USD 0.1" for 2 MXN: the line keeps the cents like every other amount
test('the conversion line shows two decimals and drops a round ".00"', () => {
    renderWithIntl(
        <AmountInput
            primaryDenomination={{ symbol: 'MXN', price: 20, decimals: 2 }}
            secondaryDenomination={USD}
            setPrimaryAmount={jest.fn()}
        />
    )
    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: '2' } })
    expect(screen.getByText('≈ USD 0.10')).toBeInTheDocument()
    fireEvent.change(field, { target: { value: '40' } })
    expect(screen.getByText('≈ USD 2')).toBeInTheDocument()
})
