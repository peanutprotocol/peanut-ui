import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '..'

const originalMatchMedia = window.matchMedia

beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    }) as typeof window.matchMedia
})

afterEach(() => {
    window.matchMedia = originalMatchMedia
})

test('mobile amount entry uses the shared keypad and retains the request slider', () => {
    const setPrimaryAmount = jest.fn()
    renderWithIntl(
        <AmountInput
            setPrimaryAmount={setPrimaryAmount}
            showSlider
            maxAmount={20}
            walletBalance="12.34"
            balanceFillAmount={12.34}
        />
    )

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveTextContent('$0')

    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decimal point' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByLabelText('Amount')).toHaveTextContent('$5.2')
    expect(setPrimaryAmount.mock.lastCall?.[0]).toBe('5.2')

    fireEvent.click(screen.getByRole('button', { name: 'Use full balance: $12.34' }))
    expect(screen.getByLabelText('Amount')).toHaveTextContent('$12.34')
})
