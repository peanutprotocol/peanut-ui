import { parseUnits } from 'viem'
import { largestLocalAmountWithinBalance, usdShortfall } from '../quote-gap'

// The lock's USDC for a local amount at a rate, as the provider quotes it
// (8 decimals) and the spend parses it (6, rounded): the same path the payment takes.
const lockedUsdcFor = (localAmount: string, rate: number) => parseUnits((Number(localAmount) / rate).toFixed(8), 6)

describe('largestLocalAmountWithinBalance', () => {
    test('quote gap: the balance covers what the form showed, so the amount shrinks to fit the lock rate', () => {
        // ARS 638,338.50 at 1200 is 531.94875 USD; the form floored it to 531.94.
        const fitted = largestLocalAmountWithinBalance({
            localAmount: '638338.50',
            shownUsd: '531.94',
            lockedUsdc: 531_948_750n,
            availableUsdc: 531_948_517n,
        })

        expect(fitted).toBe('638338.22')
        expect(lockedUsdcFor(fitted!, 1200)).toBeLessThanOrEqual(531_948_517n)
        // a cent more would not fit
        expect(lockedUsdcFor('638338.23', 1200)).toBeGreaterThan(531_948_517n)
    })

    test('quote gap from a rate move: the fitted amount fits at the lock rate, not the display rate', () => {
        // BRL 2,819.33 shown at 5.30 (531.94 USD); the lock priced it at 5.29.
        const locked = lockedUsdcFor('2819.33', 5.29)
        const fitted = largestLocalAmountWithinBalance({
            localAmount: '2819.33',
            shownUsd: '531.94',
            lockedUsdc: locked,
            availableUsdc: 531_948_517n,
        })

        expect(fitted).not.toBeNull()
        expect(Number(fitted)).toBeLessThan(2819.33)
        expect(lockedUsdcFor(fitted!, 5.29)).toBeLessThanOrEqual(531_948_517n)
    })

    test('settling: a live balance below what the form showed is not a quote gap', () => {
        expect(
            largestLocalAmountWithinBalance({
                localAmount: '638338.50',
                shownUsd: '531.94',
                lockedUsdc: 531_948_750n,
                availableUsdc: 500_000_000n,
            })
        ).toBeNull()
    })

    test('no amount on the form is not a quote gap', () => {
        expect(
            largestLocalAmountWithinBalance({
                localAmount: '638338.50',
                shownUsd: undefined,
                lockedUsdc: 531_948_750n,
                availableUsdc: 531_948_517n,
            })
        ).toBeNull()
    })
})

describe('usdShortfall', () => {
    test('rounds a sub-cent gap up to one cent', () => {
        expect(usdShortfall(10_000_000n, 9_999_999n)).toBe('0.01')
    })

    test('keeps whole cents and drops a round ".00"', () => {
        expect(usdShortfall(10_000_000n, 9_950_000n)).toBe('0.05')
        expect(usdShortfall(10_000_000n, 8_000_000n)).toBe('2')
        expect(usdShortfall(1_500_000_000n, 250_000_000n)).toBe('1,250')
    })
})
