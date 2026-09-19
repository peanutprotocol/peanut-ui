import { collectedTotal } from '../collected'

/*
 * A request covered by a bank transfer read "$0 contributed / $30 remaining"
 * above a line saying it was already covered. The bank share was simply not
 * counted.
 */
describe('collectedTotal', () => {
    it('counts a bank deposit, which is where the $0 came from', () => {
        expect(collectedTotal({ totalCollectedAmount: 0, receivedAmount: '30' })).toBe(30)
    })

    it('adds the two, because a charge and a deposit never overlap', () => {
        expect(collectedTotal({ totalCollectedAmount: 60, receivedAmount: '40' })).toBe(100)
    })

    it('is the charge total alone where the read carries no bank figure', () => {
        expect(collectedTotal({ totalCollectedAmount: 12, receivedAmount: null })).toBe(12)
        expect(collectedTotal({ totalCollectedAmount: 12 })).toBe(12)
    })

    it('is zero for a request nobody has paid, and for no request at all', () => {
        expect(collectedTotal({ totalCollectedAmount: 0, receivedAmount: null })).toBe(0)
        expect(collectedTotal(undefined)).toBe(0)
    })

    it('ignores a bank figure it cannot read rather than turning the total into NaN', () => {
        expect(collectedTotal({ totalCollectedAmount: 5, receivedAmount: 'not a number' })).toBe(5)
    })
})
