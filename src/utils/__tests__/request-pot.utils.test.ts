// What one charge put into a request (TASK-23856): a $58.51 charge that
// received 33 USDC contributed $33, not $58.51.
import { contributedAmount, isPartialContribution } from '../request-pot.utils'
import type { Payment, TStatus } from '@/services/services.types'

const payment = (status: TStatus, paidAmountInRequestedToken: string | null): Payment =>
    ({ uuid: `pay-${status}`, status, paidAmountInRequestedToken }) as Payment

describe('contributedAmount', () => {
    it('reads the settled amount the API sends', () => {
        expect(
            contributedAmount({
                tokenAmount: '58.51',
                tokenDecimals: 6,
                settledAmount: '33',
                payments: [payment('SUCCESSFUL', '58510000')],
            })
        ).toBe('33')
    })

    it('sums the successful payments, scaled by the token decimals, before the API sends it', () => {
        expect(
            contributedAmount({
                tokenAmount: '58.51',
                tokenDecimals: 6,
                payments: [payment('SUCCESSFUL', '30000000'), payment('SUCCESSFUL', '3000000'), payment('FAILED', '1')],
            })
        ).toBe('33')
    })

    it('falls back to the asked amount without decimals (the history rollup carries none)', () => {
        expect(contributedAmount({ tokenAmount: '58.51', payments: [payment('SUCCESSFUL', '33000000')] })).toBe('58.51')
    })

    it('falls back to the asked amount when a successful payment has no settled figure', () => {
        expect(
            contributedAmount({
                tokenAmount: '58.51',
                tokenDecimals: 6,
                payments: [payment('SUCCESSFUL', '33000000'), payment('SUCCESSFUL', null)],
            })
        ).toBe('58.51')
    })

    it('falls back to the asked amount on a malformed figure', () => {
        expect(
            contributedAmount({ tokenAmount: '10', tokenDecimals: 6, payments: [payment('SUCCESSFUL', '1.5')] })
        ).toBe('10')
    })

    it('treats a null settled amount as not yet known', () => {
        expect(contributedAmount({ tokenAmount: '10', tokenDecimals: 6, settledAmount: null, payments: [] })).toBe('10')
    })
})

describe('isPartialContribution', () => {
    it('is the API flag, and false when the API does not send it', () => {
        expect(isPartialContribution({ partialPayment: true })).toBe(true)
        expect(isPartialContribution({ partialPayment: false })).toBe(false)
        expect(isPartialContribution({})).toBe(false)
    })
})
