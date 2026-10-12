import { act, renderHook } from '@testing-library/react'
import { useMantecaAmountSeed } from '../useMantecaAmountSeed'

function harness(urlAmount = '50', currencyPriceSell: number | undefined = 1500) {
    const setUsdAmount = jest.fn()
    const setCurrencyAmount = jest.fn()
    const view = renderHook(
        (props: { urlAmount: string; currencyPriceSell: number | undefined }) =>
            useMantecaAmountSeed({ ...props, setUsdAmount, setCurrencyAmount }),
        { initialProps: { urlAmount, currencyPriceSell } }
    )
    return { ...view, setUsdAmount, setCurrencyAmount }
}

it('prefills both denominations without navigating', () => {
    const { setUsdAmount, setCurrencyAmount } = harness()
    expect(setUsdAmount).toHaveBeenCalledWith('50.00')
    expect(setCurrencyAmount).toHaveBeenCalledWith('75000.00')
})

it.each(['', '0', '-5', 'abc', '1e21', '1e-3x'])('ignores invalid amount %s', (amount) => {
    expect(harness(amount).setUsdAmount).not.toHaveBeenCalled()
})

it('waits for the FX rate', () => {
    const { rerender, setCurrencyAmount } = harness('50', 0)
    expect(setCurrencyAmount).not.toHaveBeenCalled()
    rerender({ urlAmount: '50', currencyPriceSell: 1500 })
    expect(setCurrencyAmount).toHaveBeenCalledWith('75000.00')
})

it('does not replace a user-edited amount when the rate changes', () => {
    const { rerender, setUsdAmount } = harness()
    rerender({ urlAmount: '50', currencyPriceSell: 1600 })
    expect(setUsdAmount).toHaveBeenCalledTimes(1)
})

it('prefills again after retry clears the fields', () => {
    const { result, setUsdAmount } = harness()
    setUsdAmount.mockClear()
    act(() => result.current.resetSeed())
    expect(setUsdAmount).toHaveBeenCalledWith('50.00')
})
