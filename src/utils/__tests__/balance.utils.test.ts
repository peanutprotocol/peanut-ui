import {
    computeAvailableSpendable,
    computeDisplaySpendable,
    isDisplayBalanceSufficient,
    printableUsdc,
    rainCentsToUsdcUnits,
} from '../balance.utils'

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

    describe('rainCentsToUsdcUnits', () => {
        it.each([
            // [cents input, expected USDC base units (6dp)]
            [0, 0n],
            [1, 10_000n], // $0.01 → 10_000 base units
            [100, 1_000_000n], // $1.00 → 1_000_000 base units
            [4950, 49_500_000n], // $49.50 → 49_500_000 base units
            [50_000, 500_000_000n], // $500.00 → 500_000_000 base units
        ])('widens %i cents to %s base units', (cents, expected) => {
            expect(rainCentsToUsdcUnits(cents)).toBe(expected)
        })

        it.each([[null], [undefined], [-100], [Number.NaN], [Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY]])(
            'returns 0n for invalid input (%s)',
            (input) => {
                expect(rainCentsToUsdcUnits(input)).toBe(0n)
            }
        )

        it('sums cleanly with a smart-account balance in base units', () => {
            const smartAccount = 150_000_000n // $150.00 USDC (6dp)
            const rainCents = 4950 // $49.50
            const total = smartAccount + rainCentsToUsdcUnits(rainCents)
            expect(printableUsdc(total)).toBe('199.50')
        })

        it("floors fractional cents (shouldn't happen but is defensive)", () => {
            expect(rainCentsToUsdcUnits(99.9)).toBe(990_000n) // floors to 99 cents
        })
    })

    describe('computeAvailableSpendable', () => {
        it('sums smart-account balance with landed collateral', () => {
            // $150 smart + $49.50 collateral = $199.50
            expect(printableUsdc(computeAvailableSpendable(150_000_000n, 4950))).toBe('199.50')
        })

        it.each([[null], [undefined], [0]])('returns smart-only when spendingPower is %s', (cents) => {
            expect(computeAvailableSpendable(1_000_000n, cents)).toBe(1_000_000n)
        })
    })

    describe('computeDisplaySpendable', () => {
        it('holds the displayed balance steady mid-top-up (funds left smart, collateral not yet landed)', () => {
            // Auto-balancer moved the user's $500 from smart → collateral. The
            // on-chain debit landed (smart now 0) but Rain hasn't credited the
            // collateral yet, so spendingPower is still 0.
            const smart = 0n
            const spendingPowerCents = 0
            const inTransitCents = 50_000 // $500 mid-flight
            // available-now craters to $0 ...
            expect(computeAvailableSpendable(smart, spendingPowerCents)).toBe(0n)
            // ... but the displayed total stays at $500 (no scary $0 flash).
            expect(printableUsdc(computeDisplaySpendable(smart, spendingPowerCents, inTransitCents))).toBe('500.00')
        })

        it('keeps the displayed total conserved as the collateral lands', () => {
            const preLanding = computeDisplaySpendable(0n, 0, 50_000) // smart 0, sp 0, in-transit $500
            const postLanding = computeDisplaySpendable(0n, 50_000, 0) // smart 0, sp $500, in-transit 0
            expect(preLanding).toBe(postLanding)
            expect(printableUsdc(preLanding)).toBe('500.00')
        })

        it.each([[0], [null], [undefined]])(
            'equals available-now when nothing is in transit (%s)',
            (inTransitCents) => {
                const smart = 150_000_000n
                expect(computeDisplaySpendable(smart, 4950, inTransitCents)).toBe(
                    computeAvailableSpendable(smart, 4950)
                )
            }
        )
    })

    describe('isDisplayBalanceSufficient (input affordability gate)', () => {
        const balance = 100_000_000n // $100 displayed spendable (6dp)

        it.each([
            ['0', true],
            ['50', true],
            ['99.99', true],
            ['100', true], // exact balance is affordable
            ['100.00', true],
            ['100.01', false], // a cent over
            ['250', false],
        ])('gates amount %s against $100 → %s', (amount, expected) => {
            expect(isDisplayBalanceSufficient(amount, balance)).toBe(expected)
        })

        it('accepts a numeric amount as well as a string', () => {
            expect(isDisplayBalanceSufficient(100, balance)).toBe(true)
            expect(isDisplayBalanceSufficient(100.01, balance)).toBe(false)
        })

        it('returns false while the balance is still loading (undefined) — never a false-positive', () => {
            expect(isDisplayBalanceSufficient('1', undefined)).toBe(false)
        })

        it.each([['abc'], ['-5'], [Number.NaN], [-1]])('returns false for invalid/negative amount (%s)', (amount) => {
            expect(isDisplayBalanceSufficient(amount, balance)).toBe(false)
        })

        it('a zero balance covers only a zero amount', () => {
            expect(isDisplayBalanceSufficient('0', 0n)).toBe(true)
            expect(isDisplayBalanceSufficient('0.01', 0n)).toBe(false)
        })

        it('gates on the DISPLAYED total incl. in-transit (the contract this PR locks in)', () => {
            // smart 0, no landed collateral, $500 in transit → display $500
            const display = computeDisplaySpendable(0n, 0, 50_000)
            expect(isDisplayBalanceSufficient('500', display)).toBe(true)
            // available-now is $0 here, but the gate must NOT block — it fails late instead
            expect(computeAvailableSpendable(0n, 0)).toBe(0n)
        })
    })
})
