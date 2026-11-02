import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '..'

function setup(amount: string) {
    const primary = jest.fn()
    const secondary = jest.fn()
    const onAmountTyped = jest.fn()
    const view = (arsPerUsd = 1200) => (
        <AmountInput
            primaryDenomination={{ symbol: 'ARS', price: arsPerUsd, decimals: 2 }}
            secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
            setPrimaryAmount={primary}
            setSecondaryAmount={secondary}
            onAmountTyped={onAmountTyped}
        />
    )
    const rendered = renderWithIntl(view())
    const field = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(field, { target: { value: amount } })
    const toggle = () => fireEvent.click(screen.getByRole('button', { name: /switch currency/i }))
    return { ...rendered, view, field, primary, secondary, onAmountTyped, toggle }
}

describe('exact payer intent across denomination round trips', () => {
    it.each(['0.05', '4000'].flatMap((amount) => [2, 4, 10].map((toggles) => ({ amount, toggles }))))(
        'preserves $amount ARS through $toggles untouched toggles',
        ({ amount, toggles }) => {
            const { field, primary, onAmountTyped, toggle } = setup(amount)
            primary.mockClear()
            for (let index = 0; index < toggles; index++) {
                toggle()
                if (index % 2 === 0) expect(Number(field.value)).toBe(amount === '0.05' ? 0 : 3.33)
                else expect(Number(field.value)).toBe(Number(amount))
                for (const [value] of primary.mock.calls) expect(Number(value)).toBe(Number(amount))
            }
            expect(onAmountTyped).toHaveBeenCalledTimes(1)
            expect(onAmountTyped).toHaveBeenLastCalledWith('ARS')
        }
    )

    it.each(['0.05', '4000'])('a real USD edit replaces the original %s ARS intent', (amount) => {
        const { field, primary, onAmountTyped, toggle } = setup(amount)
        toggle()
        fireEvent.change(field, { target: { value: '1.23' } })
        expect(Number(primary.mock.lastCall?.[0])).toBe(1476)
        expect(onAmountTyped).toHaveBeenLastCalledWith('USD')
        primary.mockClear()
        toggle()
        expect(Number(field.value)).toBe(1476)
        for (const [value] of primary.mock.calls) expect(Number(value)).toBe(1476)
        expect(onAmountTyped).toHaveBeenCalledTimes(2)
    })

    it.each(['0.05', '4000'])('rate updates preserve the original %s ARS intent', (amount) => {
        const { field, primary, secondary, toggle, rerender, view } = setup(amount)
        toggle()
        primary.mockClear()
        rerender(view(800))
        for (const [value] of primary.mock.calls) expect(Number(value)).toBe(Number(amount))
        toggle()
        expect(Number(field.value)).toBe(Number(amount))
        for (const [value] of primary.mock.calls) expect(Number(value)).toBe(Number(amount))
        expect(Number(secondary.mock.lastCall?.[0])).toBe(amount === '0.05' ? 0 : 5)
        toggle()
        expect(Number(field.value)).toBe(amount === '0.05' ? 0 : 5)
        for (const [value] of primary.mock.calls) expect(Number(value)).toBe(Number(amount))
    })
})
