import { parseBoundedNumber } from '../number-input'

describe('parseBoundedNumber', () => {
    it.each(['', ' ', 'not-a-number', 'Infinity'])('rejects %p', (value) => {
        expect(parseBoundedNumber(value, -1, 1)).toBeNull()
    })

    it('keeps finite values inside the range', () => {
        expect(parseBoundedNumber('0.25', -1, 1)).toBe(0.25)
    })

    it('clamps finite values to the range', () => {
        expect(parseBoundedNumber('-2', -1, 1)).toBe(-1)
        expect(parseBoundedNumber('12000', 0, 10000)).toBe(10000)
    })
})
