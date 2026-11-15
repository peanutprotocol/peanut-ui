import { useEffect, useSyncExternalStore } from 'react'
import type { RainCardFunding, RainCardOverview, RainCardSummary, RainFundingAccess } from '@/services/rain'
import { isRainBalanceKnown } from '@/utils/balance.utils'
import { fundingSetupPath, isFundingWithdrawalInFlight, needsFundingGrant } from '@/utils/rain-funding.utils'
import type { CardSetupPath } from './types'

export interface CardFundingInputs {
    hasActiveCard: boolean
    accessLoading: boolean
    /** undefined while loading or after a failed read */
    access: RainFundingAccess | undefined
}

/** The server's funding decision for the active card; a failed read offers nothing, never legacy. */
export function cardSetupPath({ hasActiveCard, accessLoading, access }: CardFundingInputs): CardSetupPath {
    if (!hasActiveCard) return 'none'
    if (accessLoading) return 'unknown'
    return fundingSetupPath(access) ?? 'none'
}

/** What an open FundingSetupPrompt knows that the server does not: the move it still owes, a grant that ended for good. */
export interface FundingPromptHold {
    owesReturn: boolean
    returnError: boolean
    endedForGood: boolean
}

const NO_HOLD: FundingPromptHold = { owesReturn: false, returnError: false, endedForGood: false }
let holds: Record<string, FundingPromptHold> = {}
const listeners = new Set<() => void>()
/** cards whose setup prompt was an update this app load */
const updatingCards = new Set<string>()

export function getFundingPromptHold(cardId: string | null): FundingPromptHold {
    return (cardId && holds[cardId]) || NO_HOLD
}

export function setFundingPromptHold(cardId: string, patch: Partial<FundingPromptHold>): void {
    const current = getFundingPromptHold(cardId)
    const next = { ...current, ...patch }
    if (
        Object.keys(next).every(
            (key) => next[key as keyof FundingPromptHold] === current[key as keyof FundingPromptHold]
        )
    )
        return
    holds = { ...holds, [cardId]: next }
    listeners.forEach((listener) => listener())
}

export function resetFundingPromptHoldsForTests(): void {
    holds = {}
    updatingCards.clear()
}

/** The card holds an approval of the existing card permission, whatever controller it targets. */
export const holdsCardApproval = (
    card: Pick<RainCardSummary, 'hasWithdrawApproval' | 'hasStoredWithdrawApproval'> | null | undefined
): boolean => !!card && (card.hasWithdrawApproval || card.hasStoredWithdrawApproval === true)

/**
 * Whether a card's setup prompt is an update of a card that already worked,
 * from `workedBefore`: the old permission on the card or the wallet, or card
 * balance. The setup clears that permission and moves the balance back, so the
 * evidence is gone by the time it is pending or returning; once seen, the card
 * stays an update for the app load.
 */
export function useCardPaymentsUpdate(cardId: string | null, workedBefore: boolean): boolean {
    useEffect(() => {
        if (cardId && workedBefore) updatingCards.add(cardId)
    }, [cardId, workedBefore])
    return workedBefore || (!!cardId && updatingCards.has(cardId))
}

export function useFundingPromptHold(cardId: string | null): FundingPromptHold {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        () => getFundingPromptHold(cardId),
        () => NO_HOLD
    )
}

export interface FundingPromptInputs {
    hasActiveCard: boolean
    isManagedPath: boolean
    endedForGood: boolean
    needsGrant: boolean | undefined
    isPending: boolean
    isWithdrawalInFlight: boolean
    finishingReturn: boolean
    offersEnrollment: boolean
    authorizationText: string | undefined
}

/** FundingSetupPrompt's show rule; `finish-card-funding`'s verdict reads the same one. */
export const fundingPromptShows = (i: FundingPromptInputs): boolean =>
    i.hasActiveCard &&
    i.isManagedPath &&
    !i.endedForGood &&
    (i.needsGrant === true ||
        i.isPending ||
        i.isWithdrawalInFlight ||
        i.finishingReturn ||
        (i.offersEnrollment && !!i.authorizationText))

/** Card balance the provider can release back to the wallet, in cents; an unreadable balance is 0. */
export const fundingReturnCents = (overview: RainCardOverview | undefined): number =>
    isRainBalanceKnown(overview) && !overview?.balanceUnavailable && overview?.balance
        ? Math.max(0, Math.floor(overview.balance.spendingPower))
        : 0

/** Funding is ready and the setup started in the prompt still owes moving the card balance back. */
export const isFinishingReturn = (
    owesReturn: boolean,
    status: string | undefined,
    returnCents: number,
    hasReturnError: boolean
): boolean => owesReturn && status === 'ready' && (returnCents > 0 || hasReturnError)

export interface FundingStateInputs extends CardFundingInputs {
    fundingLoading: boolean
    /** undefined while loading or after a failed read */
    funding: RainCardFunding | undefined
    overview: RainCardOverview | undefined
    hold: FundingPromptHold
}

/** The card's setup path and whether FundingSetupPrompt would show; `needsFunding` is undefined while it loads. */
export function cardFundingState(input: FundingStateInputs): {
    setupPath: CardSetupPath
    needsFunding: boolean | undefined
} {
    const setupPath = cardSetupPath(input)
    if (setupPath !== 'managed') return { setupPath, needsFunding: false }
    if (input.fundingLoading) return { setupPath, needsFunding: undefined }
    const { funding, access, hold } = input
    const status = funding?.management.status
    return {
        setupPath,
        needsFunding: fundingPromptShows({
            hasActiveCard: input.hasActiveCard,
            isManagedPath: true,
            endedForGood: hold.endedForGood,
            needsGrant: status === undefined ? undefined : needsFundingGrant(status, funding?.management.reason),
            isPending: status === 'pending',
            isWithdrawalInFlight: !!funding && isFundingWithdrawalInFlight(funding),
            finishingReturn: isFinishingReturn(
                hold.owesReturn,
                status,
                fundingReturnCents(input.overview),
                hold.returnError
            ),
            offersEnrollment: access?.fundingMode === 'legacy' && access.enrollmentAllowed,
            authorizationText: funding?.permission.authorizationText,
        }),
    }
}
