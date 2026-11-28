import { finiteAmountText, parseAsAmount } from '../amount-param'

it('keeps plain decimal text and drops anything the amount field would not hold', () => {
    expect(parseAsAmount.parse('12.5')).toBe('12.5')
    expect(parseAsAmount.parse('.5')).toBe('.5')
    for (const bad of ['5e3', 'abc', '-5', '1,000', '1.2.3', 'Infinity', ' 5']) {
        expect(parseAsAmount.parse(bad)).toBeNull()
    }
    expect(finiteAmountText('5e3')).toBe('')
})
