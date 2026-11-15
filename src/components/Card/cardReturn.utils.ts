import type { CardCollateralReturn, RainCardBalance } from '@/services/rain'
import { rainCentsToUsdcUnits } from '@/utils/balance.utils'
import { formatAmountNumber } from '@/utils/currency'

/** One cent may stay behind: the provider signs whole cents, and the backend accepts the same. */
const RETURN_TOLERANCE_CENTS = 1

const wholeCents = (value: number | undefined): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0

export interface CardReturnFacts {
    /** The user's balance still in a frozen card. */
    leftCents: number
    /** The backend could not read the balance, so it cannot say what is left in a frozen card. */
    unknown: boolean
    /** Reserved for pending and posted card payments. It stays in the card. */
    heldCents: number
    /** Refund credit: spendable with a card, not movable. */
    creditCents: number
}

/**
 * What a lock or cancel left in the card, or null when there is nothing to
 * tell: the balance moved, or the backend predates `collateralReturn`. A
 * cancel is refused while the user's balance is in the card, so only a lock
 * reports that balance.
 */
export const cardReturnFacts = (
    action: 'lock' | 'cancel',
    collateralReturn: CardCollateralReturn | null | undefined
): CardReturnFacts | null => {
    if (!collateralReturn) return null
    const remainingCents = wholeCents(collateralReturn.remainingCents)
    const facts: CardReturnFacts = {
        leftCents: action === 'lock' && remainingCents > RETURN_TOLERANCE_CENTS ? remainingCents : 0,
        unknown: action === 'lock' && collateralReturn.state === 'unknown',
        heldCents: wholeCents(collateralReturn.heldCents),
        creditCents: wholeCents(collateralReturn.cardCreditCents),
    }
    return facts.leftCents || facts.unknown || facts.heldCents || facts.creditCents ? facts : null
}

/**
 * What a lock or cancel signs a return for, in USDC units: the smaller of the
 * provider's spending power and its credit limit, from one overview read.
 *
 * A merchant refund raises spending power and adds nothing on-chain, so the
 * full spending power can be more than the card holds; the provider then
 * refuses to sign and the freeze or cancel never reaches the backend. The
 * credit limit is the provider's count of the collateral: on production on
 * 2026-11-12, for 10 cardholders, it equaled the on-chain collateral, and a
 * refund was a negative posted charge (mono
 * ops/plans/2026-11-09-task-24511-card-return-plan.md, section 6, V4). An open
 * signature lowers both numbers, so the minimum is never above spending power.
 *
 * A credit limit that is absent, not a finite number or negative says nothing:
 * spending power decides, as before. A credit limit of 0 with spending power
 * left means only refund credit remains: nothing is signed, and the backend
 * reports the credit.
 */
export const cardReturnUnits = (
    balance: Partial<Pick<RainCardBalance, 'spendingPower' | 'creditLimit'>> | null | undefined
): bigint => {
    const spendingPowerUnits = rainCentsToUsdcUnits(balance?.spendingPower)
    const creditLimit = balance?.creditLimit
    if (typeof creditLimit !== 'number' || !Number.isFinite(creditLimit) || creditLimit < 0) return spendingPowerUnits
    const creditLimitUnits = rainCentsToUsdcUnits(creditLimit)
    return creditLimitUnits < spendingPowerUnits ? creditLimitUnits : spendingPowerUnits
}

/** "$20", "$10.06": whole cents as a display amount. */
export const formatCardCents = (cents: number): string => `$${formatAmountNumber(cents / 100)}`
