import {
    cardBalanceDueCents,
    computeAvailableSpendable,
    isAmountWithinBalance,
    isRainBalanceKnown,
    isValidSendAmount,
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

    describe('cardBalanceDueCents', () => {
        it('surfaces a negative spending power as positive debt cents (incident: -631 = $6.31 due)', () => {
            expect(cardBalanceDueCents(-631)).toBe(631)
        })

        it.each([
            [0, 0],
            [4218, 0], // healthy positive balance — no debt
            [null, 0],
            [undefined, 0],
            [Number.NaN, 0],
            [Number.NEGATIVE_INFINITY, 0],
        ])('returns 0 for non-debt input (%s)', (input, expected) => {
            expect(cardBalanceDueCents(input)).toBe(expected)
        })

        it('rounds fractional cents from the wire', () => {
            expect(cardBalanceDueCents(-630.6)).toBe(631)
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

    describe('isAmountWithinBalance (input affordability gate)', () => {
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
            expect(isAmountWithinBalance(amount, balance)).toBe(expected)
        })

        it('accepts a numeric amount as well as a string', () => {
            expect(isAmountWithinBalance(100, balance)).toBe(true)
            expect(isAmountWithinBalance(100.01, balance)).toBe(false)
        })

        it('returns false while the balance is still loading (undefined) — never a false-positive', () => {
            expect(isAmountWithinBalance('1', undefined)).toBe(false)
        })

        it.each([['abc'], ['-5'], [Number.NaN], [-1]])('returns false for invalid/negative amount (%s)', (amount) => {
            expect(isAmountWithinBalance(amount, balance)).toBe(false)
        })

        it.each([[Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY], ['1e999'], ['Infinity']])(
            'never throws on non-finite / overflowing amount (%s) — returns false, not a RangeError',
            (amount) => {
                expect(() => isAmountWithinBalance(amount, balance)).not.toThrow()
                expect(isAmountWithinBalance(amount, balance)).toBe(false)
            }
        )

        it('a zero balance covers only a zero amount', () => {
            expect(isAmountWithinBalance('0', 0n)).toBe(true)
            expect(isAmountWithinBalance('0.01', 0n)).toBe(false)
        })
    })

    // The distinction the $0-balance bug collapsed: a user with no card is a real
    // zero, an overview that never arrived is unknown. Shared by the display path
    // (useWallet) and the spend path (useSpendBundle) so they can't disagree.
    describe('isRainBalanceKnown', () => {
        it('treats a present balance as known', () => {
            expect(isRainBalanceKnown({ balance: { spendingPower: 100 } })).toBe(true)
        })

        it('treats a null balance with no failure flag as known — a user with no card', () => {
            expect(isRainBalanceKnown({ balance: null })).toBe(true)
            expect(isRainBalanceKnown({ balance: null, balanceUnavailable: false })).toBe(true)
        })

        it('treats a flagged null balance as unknown', () => {
            expect(isRainBalanceKnown({ balance: null, balanceUnavailable: true })).toBe(false)
        })

        it('trusts a stale-but-served balance even when flagged', () => {
            expect(isRainBalanceKnown({ balance: { spendingPower: 100 }, balanceUnavailable: true })).toBe(true)
        })

        it('treats a missing overview as unknown, without throwing on null', () => {
            expect(isRainBalanceKnown(undefined)).toBe(false)
            expect(isRainBalanceKnown(null)).toBe(false)
        })
    })

    // Gates the send-link amount: string truthiness let "0"/"0.00" create a
    // real zero-value on-chain link (TASK-21669).
    describe('isValidSendAmount', () => {
        it('accepts positive amounts, including sub-cent ones', () => {
            expect(isValidSendAmount('1')).toBe(true)
            expect(isValidSendAmount('0.01')).toBe(true)
            expect(isValidSendAmount('0.000001')).toBe(true)
            expect(isValidSendAmount('123.45')).toBe(true)
            expect(isValidSendAmount(5)).toBe(true)
        })

        it('rejects zero in every spelling', () => {
            expect(isValidSendAmount('0')).toBe(false)
            expect(isValidSendAmount('0.00')).toBe(false)
            expect(isValidSendAmount('00')).toBe(false)
            expect(isValidSendAmount(0)).toBe(false)
        })

        it('rejects empty and missing input', () => {
            expect(isValidSendAmount('')).toBe(false)
            expect(isValidSendAmount('   ')).toBe(false)
            expect(isValidSendAmount(null)).toBe(false)
            expect(isValidSendAmount(undefined)).toBe(false)
        })

        it('rejects anything parseUnits would reject at spend time', () => {
            expect(isValidSendAmount('abc')).toBe(false)
            expect(isValidSendAmount('1,50')).toBe(false)
            expect(isValidSendAmount('-1')).toBe(false)
            expect(isValidSendAmount('0.0000001')).toBe(false) // more than 6 decimals
            expect(isValidSendAmount(NaN)).toBe(false)
            expect(isValidSendAmount(Infinity)).toBe(false)
        })
    })
})
