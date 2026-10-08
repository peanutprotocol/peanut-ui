import { convertedAccountTotal, displayAccountUnits, sendAmountUnits } from '../converted-balance'

it('values the other balance in the sending currency with exact decimal arithmetic', () => {
    expect(convertedAccountTotal(10_000_000n, 20_000_000n, '1.1')).toBe(32_000_000n)
    expect(convertedAccountTotal(20_000_000n, 10_000_000n, '0.9')).toBe(29_000_000n)
    expect(convertedAccountTotal(1n, 1n, '0.999999999999999999')).toBe(1n)
    expect(displayAccountUnits(1_999_999n)).toBe('1.99')
})
it.each(['0', '-1', 'NaN', 'Infinity', '1e2', '1,1', '1.1234567890123456789'])('rejects invalid rate %s', (rate) => {
    expect(convertedAccountTotal(1n, 1n, rate)).toBeUndefined()
})
it.each(['', '0', '-1', '1e2', '1,000', '1.1234567'])('does not infer a shortfall from invalid amount %s', (amount) => {
    expect(sendAmountUnits(amount)).toBeUndefined()
})
it('retains all six digits for balance comparisons and avoids unsafe number coercion', () => {
    expect(sendAmountUnits('0.000001')).toBe(1n)
    expect(convertedAccountTotal(9007199254740993n, 9007199254740993n, '1')).toBe(18014398509481986n)
})
