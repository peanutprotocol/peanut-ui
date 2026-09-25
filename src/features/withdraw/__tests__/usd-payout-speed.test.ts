import {
    DEFAULT_USD_PAYOUT_SPEED,
    effectiveUsdPayoutSpeed,
    usdAmountReceived,
    usdPayoutSpeedOptions,
} from '../usd-payout-speed'

const FEES = {
    minimumAfterFeeUsd: '1.00',
    rails: [
        { rail: 'ach', feeUsd: '0.00' },
        { rail: 'ach_same_day', feeUsd: '0.00' },
        { rail: 'wire', feeUsd: '20.00' },
    ],
}

describe('usdPayoutSpeedOptions — the fee comes from the backend table, never the app', () => {
    it('offers standard ACH (the default), same-day ACH and a wire at the table fee, in that order', () => {
        expect(DEFAULT_USD_PAYOUT_SPEED).toBe('ach')
        expect(usdPayoutSpeedOptions({ fees: FEES, amountUsd: 100 })).toEqual([
            { speed: 'ach', feeUsd: '0.00', minimumUsd: '1.00', block: null },
            { speed: 'ach_same_day', feeUsd: '0.00', minimumUsd: '1.00', block: null },
            { speed: 'wire', feeUsd: '20.00', minimumUsd: '21.00', block: null },
        ])
    })

    it('uses whatever fee the table states', () => {
        const options = usdPayoutSpeedOptions({
            fees: { ...FEES, rails: [{ rail: 'wire', feeUsd: '15.00' }] },
            amountUsd: 100,
        })
        expect(options.find((option) => option.speed === 'wire')).toMatchObject({
            feeUsd: '15.00',
            minimumUsd: '16.00',
        })
    })

    it('blocks a wire under the fee plus the minimum, at the boundary', () => {
        const at = (amountUsd: number) =>
            usdPayoutSpeedOptions({ fees: FEES, amountUsd }).find((option) => option.speed === 'wire')!.block
        expect(at(20.99)).toBe('belowMinimum')
        expect(at(21)).toBeNull()
        expect(at(Number.NaN)).toBe('belowMinimum')
    })

    it("blocks a wire the account cannot take, per the provider's answer, and never an ACH speed", () => {
        const options = usdPayoutSpeedOptions({ fees: FEES, amountUsd: 0.5, supportedRails: ['ach'] })
        expect(options.map((option) => [option.speed, option.block])).toEqual([
            ['ach', null],
            ['ach_same_day', null],
            ['wire', 'accountCannotTake'],
        ])
    })

    it('with no fee table (an older backend, a failed read) offers standard ACH alone', () => {
        expect(usdPayoutSpeedOptions({ fees: null, amountUsd: 100 })).toEqual([
            { speed: 'ach', feeUsd: '0.00', minimumUsd: '1.00', block: null },
        ])
    })
})

describe('effectiveUsdPayoutSpeed', () => {
    it('falls back to standard ACH when the wire asked for cannot be picked', () => {
        expect(effectiveUsdPayoutSpeed(usdPayoutSpeedOptions({ fees: FEES, amountUsd: 10 }), 'wire')).toBe('ach')
    })

    it('keeps a wire or same-day ACH that can be picked', () => {
        const options = usdPayoutSpeedOptions({ fees: FEES, amountUsd: 50 })
        expect(effectiveUsdPayoutSpeed(options, 'wire')).toBe('wire')
        expect(effectiveUsdPayoutSpeed(options, 'ach_same_day')).toBe('ach_same_day')
    })

    it('falls back when the speed is not offered at all', () => {
        const options = usdPayoutSpeedOptions({ fees: null, amountUsd: 50 })
        expect(effectiveUsdPayoutSpeed(options, 'wire')).toBe('ach')
        expect(effectiveUsdPayoutSpeed(options, 'ach_same_day')).toBe('ach')
    })
})

describe('usdAmountReceived', () => {
    it('is the amount less the fee, to the cent', () => {
        expect(usdAmountReceived(50, '20.00')).toBe('30.00')
        expect(usdAmountReceived(100.1, '20.00')).toBe('80.10')
        expect(usdAmountReceived(50, '0.00')).toBe('50.00')
    })

    it('never goes below zero', () => {
        expect(usdAmountReceived(10, '20.00')).toBe('0.00')
    })
})
