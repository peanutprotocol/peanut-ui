import type { CardCollateralReturn } from '@/services/rain'
import { formatAmountNumber } from '@/utils/currency'

/** One cent may stay behind: the provider signs whole cents, and the backend accepts the same. */
const RETURN_TOLERANCE_CENTS = 1

const wholeCents = (value: number | undefined): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0

export interface CardReturnFacts {
    /** The user's balance still in the card after a lock or cancel. */
    leftCents: number
    /** The backend could not read the balance, so it cannot say what is left. */
    unknown: boolean
    /** Reserved for pending and posted card payments. It stays in the card. */
    heldCents: number
    /** Refund credit: spendable with a card, not movable. */
    creditCents: number
}

/**
 * What a lock or cancel left in the card, or null when there is nothing to
 * tell: the balance moved, or the backend predates `collateralReturn`.
 */
export const cardReturnFacts = (collateralReturn: CardCollateralReturn | null | undefined): CardReturnFacts | null => {
    if (!collateralReturn) return null
    const remainingCents = wholeCents(collateralReturn.remainingCents)
    const facts: CardReturnFacts = {
        leftCents: remainingCents > RETURN_TOLERANCE_CENTS ? remainingCents : 0,
        unknown: collateralReturn.state === 'unknown',
        heldCents: wholeCents(collateralReturn.heldCents),
        creditCents: wholeCents(collateralReturn.cardCreditCents),
    }
    return facts.leftCents || facts.unknown || facts.heldCents || facts.creditCents ? facts : null
}

/** "$20", "$10.06": whole cents as a display amount. */
export const formatCardCents = (cents: number): string => `$${formatAmountNumber(cents / 100)}`
