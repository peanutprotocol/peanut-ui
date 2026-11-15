import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '..'

const overflowingDecimal = '9'.repeat(400)

function expectFiniteOutput(container: HTMLElement, onAmount: jest.Mock) {
    expect(container.textContent).not.toMatch(/NaN|Infinity/)
    for (const input of container.querySelectorAll('input')) {
        expect(input.value).not.toMatch(/NaN|Infinity/)
        if (input.value !== '') expect(Number.isFinite(Number(input.value.replace(/,/g, '')))).toBe(true)
    }
    for (const slider of screen.queryAllByRole('slider')) {
        for (const attribute of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax']) {
            const value = slider.getAttribute(attribute)
            if (value !== null) expect(Number.isFinite(Number(value))).toBe(true)
        }
        expect(slider.getAttribute('aria-valuetext') ?? '').not.toMatch(/NaN|Infinity/)
    }
    for (const [value] of onAmount.mock.calls) {
        expect(typeof value).toBe('string')
        expect(value).not.toMatch(/NaN|Infinity|,/)
        if (value !== '') expect(Number.isFinite(Number(value))).toBe(true)
    }
}

describe('finite request amounts with the real slider', () => {
    test.each([999, 1000, 4000, 10000])('suggested %s remains the same finite raw amount', (amount) => {
        const onAmount = jest.fn()
        const { container } = renderWithIntl(
            <AmountInput
                setPrimaryAmount={onAmount}
                showSlider
                maxAmount={10000}
                defaultSliderSuggestedAmount={amount}
            />
        )
        const field = screen.getByRole('textbox') as HTMLInputElement
        expect(Number(field.value.replace(/,/g, ''))).toBe(amount)
        expect(onAmount).toHaveBeenLastCalledWith(String(amount))
        expect(screen.getAllByRole('slider').length).toBeGreaterThan(0)
        expectFiniteOutput(container, onAmount)
    })

    test.each(['NaN', 'Infinity', '-Infinity', overflowingDecimal])(
        'invalid initial amount %s stays finite',
        (amount) => {
            const onAmount = jest.fn()
            const { container } = renderWithIntl(
                <AmountInput initialAmount={amount} setPrimaryAmount={onAmount} showSlider maxAmount={10000} />
            )
            expectFiniteOutput(container, onAmount)
            fireEvent.change(screen.getByRole('textbox'), { target: { value: '4000' } })
            expect(onAmount).toHaveBeenLastCalledWith('4000')
            expectFiniteOutput(container, onAmount)
        }
    )

    test.each([NaN, Infinity, -Infinity])('invalid suggestion %s stays finite', (amount) => {
        const onAmount = jest.fn()
        const { container } = renderWithIntl(
            <AmountInput
                setPrimaryAmount={onAmount}
                showSlider
                maxAmount={10000}
                defaultSliderSuggestedAmount={amount}
            />
        )
        expectFiniteOutput(container, onAmount)
    })

    test.each(['NaN', 'Infinity', overflowingDecimal, '1.2.3'])('invalid typed amount %s cannot escape', (amount) => {
        const onAmount = jest.fn()
        const { container } = renderWithIntl(<AmountInput setPrimaryAmount={onAmount} showSlider maxAmount={10000} />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: amount } })
        expectFiniteOutput(container, onAmount)
    })
})
