import type { RainFundingAccess } from '@/services/rain'
import { fundingSetupPath } from '@/utils/rain-funding.utils'
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
