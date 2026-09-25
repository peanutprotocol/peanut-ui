import {
    DEFAULT_USD_PAYOUT_SPEED,
    effectiveUsdPayoutSpeed,
    usdAmountReceived,
    usdPayoutSpeedOptions,
} from '../usd-payout-speed'

const FEES = {
    minimumAfterFeeUsd: '1.00',
    rails: [
        { rail: 'ach_same_day', feeUsd: '0.00' },
        { rail: 'wire', feeUsd: '20.00' },
    ],
}

describe('usdPayoutSpeedOptions — the fee comes from the backend table, never the app', () => {
    it('offers same-day ACH free and a wire at the table fee, in that order', () => {
        expect(usdPayoutSpeedOptions({ fees: FEES, amountUsd: 100 })).toEqual([
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

    it("blocks a wire the account cannot take, per the provider's answer", () => {
        const options = usdPayoutSpeedOptions({ fees: FEES, amountUsd: 100, supportedRails: ['ach', 'ach_same_day'] })
        expect(options.map((option) => option.block)).toEqual([null, 'accountCannotTake'])
    })

    it('never blocks same-day ACH: the provider sends it next-day where needed', () => {
        const options = usdPayoutSpeedOptions({ fees: FEES, amountUsd: 0.5, supportedRails: ['ach', 'wire'] })
        expect(options[0]).toMatchObject({ speed: 'ach_same_day', block: null })
    })

    it('with no fee table (an older backend, a failed read) offers same-day ACH alone', () => {
        expect(usdPayoutSpeedOptions({ fees: null, amountUsd: 100 })).toEqual([
            { speed: 'ach_same_day', feeUsd: '0.00', minimumUsd: '1.00', block: null },
        ])
    })
})

describe('effectiveUsdPayoutSpeed', () => {
    const options = usdPayoutSpeedOptions({ fees: FEES, amountUsd: 10 })

    it('falls back to same-day ACH when the wire asked for cannot be picked', () => {
        expect(effectiveUsdPayoutSpeed(options, 'wire')).toBe(DEFAULT_USD_PAYOUT_SPEED)
    })

    it('keeps a wire that can be picked', () => {
        expect(effectiveUsdPayoutSpeed(usdPayoutSpeedOptions({ fees: FEES, amountUsd: 50 }), 'wire')).toBe('wire')
    })

    it('falls back when the wire is not offered at all', () => {
        expect(effectiveUsdPayoutSpeed(usdPayoutSpeedOptions({ fees: null, amountUsd: 50 }), 'wire')).toBe(
            'ach_same_day'
        )
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
