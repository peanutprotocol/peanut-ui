import { mantecaWithdrawInitRequest } from '../manteca-withdraw-init'

const base = {
    usdAmount: '13.33',
    currencyAmount: '20000',
    currency: 'ARS',
    isAmountTypedInUsd: false,
    usdSourcedCurrencyAmount: null,
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

    it('a local amount still equal to the one derived from USD keeps the USD amount, compared as numbers', () => {
        expect(mantecaWithdrawInitRequest({ ...base, usdSourcedCurrencyAmount: '20000.00' })).toEqual({
            amount: '13.33',
            currency: 'ARS',
        })
    })

    it('a local amount edited after the USD hand-off is the amount to deliver', () => {
        expect(mantecaWithdrawInitRequest({ ...base, usdSourcedCurrencyAmount: '75000.00' }).fiatAmount).toBe('20000')
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
