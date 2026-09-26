import { requestFulfillmentState, requestIsSettled } from '../requestFulfillment'

const request = (over: Partial<Parameters<typeof requestFulfillmentState>[0]> = {}) => ({
    paidAt: null,
    receivedAmount: null,
    tokenAmount: '250',
    ...over,
})

describe('requestFulfillmentState', () => {
    // The backend decides this now, because the tolerance that makes a
    // slightly-short transfer count as paid lives where the deposit is booked.
    describe('with the backend verdict', () => {
        it.each([
            ['none', 'unpaid'],
            ['partial', 'partial'],
            ['paid', 'paid'],
        ] as const)('reads %s as %s', (bankFulfilment, expected) => {
            expect(requestFulfillmentState(request({ bankFulfilment }))).toBe(expected)
        })

        // A transfer loses fees on the way, so the backend counts a slightly
        // short amount as paid. Re-comparing the numbers here would put
        // "partly paid" over a request the backend already closed.
        it('does not second-guess a paid verdict over a short amount', () => {
            const state = requestFulfillmentState(
                request({ bankFulfilment: 'paid', paidAt: '2026-09-17T10:00:00.000Z', receivedAmount: '247' })
            )

            expect(state).toBe('paid')
        })
    })

    describe('without the field', () => {
        it('reads a request no deposit answered as unpaid', () => {
            expect(requestFulfillmentState(request())).toBe('unpaid')
        })

        it('reads less than the asked amount as a part payment', () => {
            const state = requestFulfillmentState(
                request({ paidAt: '2026-09-17T10:00:00.000Z', receivedAmount: '100' })
            )

            expect(state).toBe('partial')
        })

        it('reads the full amount as paid', () => {
            const state = requestFulfillmentState(
                request({ paidAt: '2026-09-17T10:00:00.000Z', receivedAmount: '250' })
            )

            expect(state).toBe('paid')
        })

        it('reads anything at all as paid when the request asked for no amount', () => {
            const state = requestFulfillmentState(
                request({ paidAt: '2026-09-17T10:00:00.000Z', receivedAmount: '5', tokenAmount: null })
            )

            expect(state).toBe('paid')
        })

        it('does not claim a part payment over amounts it could not compare', () => {
            const state = requestFulfillmentState(
                request({ paidAt: '2026-09-17T10:00:00.000Z', receivedAmount: 'abc' })
            )

            expect(state).toBe('paid')
        })
    })
})

/**
 * Settlement is a question about the REQUEST; `bankFulfilment` answers only
 * about the bank book (peanut-api-ts#1647). The two disagree on a request paid
 * partly by bank and partly from a Peanut balance — QA round 2, Q5.
 */
describe('requestIsSettled', () => {
    it('is true once the request is paid, whichever way the money came', () => {
        expect(requestIsSettled({ bankFulfilment: 'partial', paidAt: '2026-09-20T22:00:00.000Z' })).toBe(true)
    })

    it('is false while money is still owed', () => {
        expect(requestIsSettled({ bankFulfilment: 'partial', paidAt: null })).toBe(false)
    })

    it('says nothing on a response from before the bank verdict existed', () => {
        // there `paidAt` meant "a bank deposit landed", and a short deposit
        // really did leave the request open — the amounts own that case
        expect(requestIsSettled({ paidAt: '2026-09-20T22:00:00.000Z' })).toBe(false)
    })
})
