import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '..'

function expectSafeAmounts(container: HTMLElement, callback: jest.Mock) {
    expect(container.textContent).not.toMatch(/NaN|Infinity|∞/)
    const sliders = screen.getAllByRole('slider')
    expect(sliders.length).toBeGreaterThan(0)
    for (const slider of sliders) {
        for (const attribute of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax']) {
            const value = slider.getAttribute(attribute)
            if (value !== null) expect(Number.isFinite(Number(value))).toBe(true)
        }
        expect(slider.getAttribute('aria-valuetext') ?? '').not.toMatch(/NaN|Infinity|∞/)
    }
    for (const [value] of callback.mock.calls) {
        expect(typeof value).toBe('string')
        expect(value === '' || Number.isFinite(Number(value))).toBe(true)
        expect(value).not.toBe('.')
    }
}

describe('progressive decimal typing with the real slider', () => {
    it('keeps the initial decimal point editable without emitting an invalid amount', () => {
        const onAmount = jest.fn()
        const { container } = renderWithIntl(<AmountInput setPrimaryAmount={onAmount} showSlider maxAmount={10000} />)
        const field = screen.getByRole('textbox') as HTMLInputElement
        fireEvent.change(field, { target: { value: '.' } })
        expect(field.value).toBe('.')
        expectSafeAmounts(container, onAmount)

        fireEvent.change(field, { target: { value: '.5' } })
        expect(field.value).toBe('.5')
        expect(onAmount).toHaveBeenLastCalledWith('.5')
        expectSafeAmounts(container, onAmount)
    })

    it('does not emit a nonfinite amount or slider value from an initial decimal point', () => {
        const onAmount = jest.fn()
        const { container } = renderWithIntl(
            <AmountInput initialAmount="." setPrimaryAmount={onAmount} showSlider maxAmount={10000} />
        )
        expectSafeAmounts(container, onAmount)
    })
})
