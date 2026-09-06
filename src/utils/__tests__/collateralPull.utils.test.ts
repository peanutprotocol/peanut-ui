import { computeCollateralPull, formatLockRemaining } from '../collateralPull.utils'

const usdc = (n: number) => BigInt(Math.round(n * 1_000_000))

describe('computeCollateralPull', () => {
    it('stays off card when the off-card balance covers the amount', () => {
        expect(computeCollateralPull({ amountUsd: '20', offCardUnits: usdc(28.4), onCardCents: 10_000 })).toEqual({
            pullsFromCard: false,
            fromCardCents: 0,
        })
    })

    it('pulls the whole amount from the card when the card alone covers it', () => {
        // Mirrors the collateral-only preference: one Rain signature, not two taps.
        expect(computeCollateralPull({ amountUsd: '50', offCardUnits: usdc(28.4), onCardCents: 10_000 })).toEqual({
            pullsFromCard: true,
            fromCardCents: 5_000,
        })
    })

    it('pulls only the shortfall when neither side covers it alone', () => {
        expect(computeCollateralPull({ amountUsd: '120', offCardUnits: usdc(28.4), onCardCents: 10_000 })).toEqual({
            pullsFromCard: true,
            fromCardCents: 9_160,
        })
    })

    it('reports nothing for a true shortfall — the insufficient error owns that', () => {
        expect(computeCollateralPull({ amountUsd: '200', offCardUnits: usdc(28.4), onCardCents: 10_000 })).toEqual({
            pullsFromCard: false,
            fromCardCents: 0,
        })
    })

    it('reports nothing while either balance is unknown', () => {
        expect(
            computeCollateralPull({ amountUsd: '50', offCardUnits: undefined, onCardCents: 10_000 }).pullsFromCard
        ).toBe(false)
        expect(computeCollateralPull({ amountUsd: '50', offCardUnits: usdc(1), onCardCents: null }).pullsFromCard).toBe(
            false
        )
    })

    it('ignores empty, zero and junk amounts', () => {
        for (const amountUsd of ['', '0', '0.00', 'abc', null, undefined]) {
            expect(computeCollateralPull({ amountUsd, offCardUnits: usdc(0), onCardCents: 10_000 }).pullsFromCard).toBe(
                false
            )
        }
    })

    it('a multi-call flow (cross-chain) can only pull the shortfall, never the whole amount', () => {
        // $28.40 off card, $100 on card, $50 cross-chain: execution goes mixed
        // through sendTransactions, so $21.60 leaves the card — not $50.
        expect(
            computeCollateralPull({
                amountUsd: '50',
                offCardUnits: usdc(28.4),
                onCardCents: 10_000,
                collateralOnlyAllowed: false,
            })
        ).toEqual({ pullsFromCard: true, fromCardCents: 2_160 })
    })

    it('floors the off-card balance to the cent so a sub-cent dust never reads as a whole cent', () => {
        // 1.000001 USDC off card is $1.00 for routing purposes, so a $1.00
        // spend stays off card; $1.01 pulls the 1-cent shortfall.
        expect(
            computeCollateralPull({ amountUsd: '1.00', offCardUnits: 1_000_001n, onCardCents: 10_000 }).pullsFromCard
        ).toBe(false)
        expect(
            computeCollateralPull({ amountUsd: '1.01', offCardUnits: 1_000_001n, onCardCents: 0 }).pullsFromCard
        ).toBe(false)
    })

    it('an empty off-card balance sends the whole amount through the card', () => {
        expect(computeCollateralPull({ amountUsd: '6.11', offCardUnits: 0n, onCardCents: 2_489 })).toEqual({
            pullsFromCard: true,
            fromCardCents: 611,
        })
    })
})

describe('formatLockRemaining', () => {
    it('renders m:ss and never goes negative', () => {
        expect(formatLockRemaining(95_000)).toBe('1:35')
        expect(formatLockRemaining(500)).toBe('0:01')
        expect(formatLockRemaining(-10)).toBe('0:00')
    })
})
