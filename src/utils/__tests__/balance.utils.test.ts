import { printableUsdc, rainSpendingPowerToWei } from '../balance.utils'

describe('balance utils', () => {
    describe('printableUsdc', () => {
        it.each([
            [0n, '0.00'],
            [10000n, '0.01'],
            [100000n, '0.10'],
            [1000000n, '1.00'],
            [10000000n, '10.00'],
            [100000000n, '100.00'],
            [1000000000n, '1000.00'],
            [10000000000n, '10000.00'],
            [100000000000n, '100000.00'],
            [1000000000000n, '1000000.00'],
            [10000000000000n, '10000000.00'],
            [100000000000000n, '100000000.00'],
            [1000000000000000n, '1000000000.00'],
            [10000000000000000n, '10000000000.00'],
            [100000000000000000n, '100000000000.00'],
            [1000000000000000000n, '1000000000000.00'],
            [303340000n, '303.34'],
            [303339000n, '303.33'],
            [303345000n, '303.34'],
        ])('should return the correct value for %i', (input, expected) => {
            expect(printableUsdc(input)).toBe(expected)
        })
    })

    describe('rainSpendingPowerToWei', () => {
        it.each([
            // [cents input, expected USDC wei (6dp)]
            [0, 0n],
            [1, 10_000n], // $0.01 → 10_000 wei
            [100, 1_000_000n], // $1.00 → 1_000_000 wei
            [4950, 49_500_000n], // $49.50 → 49_500_000 wei
            [50_000, 500_000_000n], // $500.00 → 500_000_000 wei
        ])('widens %i cents to %s wei', (cents, expected) => {
            expect(rainSpendingPowerToWei(cents)).toBe(expected)
        })

        it.each([[null], [undefined], [-100], [Number.NaN], [Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY]])(
            'returns 0n for invalid input (%s)',
            (input) => {
                expect(rainSpendingPowerToWei(input)).toBe(0n)
            }
        )

        it('sums cleanly with a smart-account balance in wei', () => {
            const smartAccount = 150_000_000n // $150.00 USDC (6dp)
            const rainCents = 4950 // $49.50
            const total = smartAccount + rainSpendingPowerToWei(rainCents)
            expect(printableUsdc(total)).toBe('199.50')
        })

        it("floors fractional cents (shouldn't happen but is defensive)", () => {
            expect(rainSpendingPowerToWei(99.9)).toBe(990_000n) // floors to 99 cents
        })
    })
})
