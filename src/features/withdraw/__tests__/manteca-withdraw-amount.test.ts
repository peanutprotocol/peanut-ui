import { lockedUsdDisplayAmount, mantecaWithdrawInitRequest } from '../manteca-withdraw-amount'

const base = {
    usdAmount: '13.33',
    currencyAmount: '20000',
    currency: 'ARS',
    isAmountTypedInUsd: false,
    isUsdSourced: false,
}

describe('mantecaWithdrawInitRequest (TASK-23997)', () => {
    it('a typed local amount is the amount to deliver; the USD estimate rides along for an older API', () => {
        expect(mantecaWithdrawInitRequest(base)).toEqual({ amount: '13.33', fiatAmount: '20000', currency: 'ARS' })
    })

    it('a mid-typing local amount is sent in the form the API accepts', () => {
        expect(mantecaWithdrawInitRequest({ ...base, currencyAmount: '90.' }).fiatAmount).toBe('90')
        expect(mantecaWithdrawInitRequest({ ...base, currencyAmount: '20,000.5' }).fiatAmount).toBe('20000.5')
    })

    it('an amount typed in USD is the amount to deliver', () => {
        expect(mantecaWithdrawInitRequest({ ...base, isAmountTypedInUsd: true })).toEqual({
            amount: '13.33',
            currency: 'ARS',
        })
    })

    it('a local amount that came from USD, untyped since, keeps the USD amount', () => {
        expect(mantecaWithdrawInitRequest({ ...base, isUsdSourced: true })).toEqual({
            amount: '13.33',
            currency: 'ARS',
        })
    })

    it.each([undefined, '', '0', '1.234', '1234567890123'])(
        'a local amount the API cannot take (%s) falls back to the USD amount',
        (currencyAmount) => {
            expect(mantecaWithdrawInitRequest({ ...base, currencyAmount })).toEqual({
                amount: '13.33',
                currency: 'ARS',
            })
        }
    )
})

describe('lockedUsdDisplayAmount (TASK-23997)', () => {
    it.each([
        ['12.493001', '12.5'],
        ['13.336891', '13.34'],
        ['20', '20'],
        ['20.000001', '20.01'],
    ])('%s USDC shows as the %s a card-funded withdrawal debits', (usdAmount, shown) => {
        expect(lockedUsdDisplayAmount(usdAmount)).toBe(shown)
    })
})
