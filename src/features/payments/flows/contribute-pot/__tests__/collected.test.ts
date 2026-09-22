import { collectedTotal, usdRemainingOf } from '../collected'

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

    /*
     * `receivedAmount` is the requester's alone, so the payer's read of a
     * request paid by bank carried no bank figure and showed "$0 contributed".
     * The payer gets it from the other end: what the request still needs.
     */
    describe("the payer's read, which carries no bank figure", () => {
        const payerRead = { totalCollectedAmount: 0, tokenAmount: '100' }

        it('counts a bank deposit from what is left to pay', () => {
            expect(collectedTotal(payerRead, 30)).toBe(70)
        })

        it('is the full amount once nothing is left', () => {
            expect(collectedTotal(payerRead, 0)).toBe(100)
        })

        it('never falls below the charges the payer can see', () => {
            expect(collectedTotal({ totalCollectedAmount: 60, tokenAmount: '100' }, 100)).toBe(60)
        })

        it('is the charge total alone where no remainder is known', () => {
            expect(collectedTotal({ totalCollectedAmount: 12, tokenAmount: '100' })).toBe(12)
            expect(collectedTotal({ totalCollectedAmount: 12, tokenAmount: null }, 30)).toBe(12)
        })
    })
})

describe('usdRemainingOf', () => {
    const rail = (kind: string, amount: string | null) => ({ kind, payerAmount: { amount } })

    it('reads the dollar rail, which is the exact remainder', () => {
        expect(usdRemainingOf({ rails: [rail('bank', '90'), rail('peanut_balance', '30')] })).toBe(30)
    })

    it('states nothing where there is no dollar rail, or no answer at all', () => {
        expect(usdRemainingOf({ rails: [rail('bank', '90')] })).toBeUndefined()
        expect(usdRemainingOf(undefined)).toBeUndefined()
        expect(usdRemainingOf({ rails: [rail('peanut_balance', null)] })).toBeUndefined()
    })

    it('zero is a remainder, not a missing one', () => {
        expect(usdRemainingOf({ rails: [rail('peanut_balance', '0')] })).toBe(0)
    })
})
