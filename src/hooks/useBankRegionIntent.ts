import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { getRegionIntent } from '@/utils/regions.utils'
import { useCallback } from 'react'

/**
 * The region intent a BANK flow should verify under.
 *
 * The destination country stays the input — it is what decides which
 * provider's rails the verification opens, and a Brazilian resident really
 * does need the Bridge level to withdraw to a Spanish IBAN. The one exception
 * is a residence no bank provider onboards (the sanctioned set, the UK rule,
 * Bridge's banking exclusions): every bank level can only end on a terminal
 * rejection there, so those get the provider-less level whatever destination
 * was picked. Same ruling as `regionIntentForResidence` makes for the
 * residence-change path, applied to the six bank entry points.
 *
 * Read off `banking` rather than the residence code so it inherits the
 * server's answer (`user.residenceRestrictions`, derived from the KYC-reported
 * residence when there is one) and the dual-resident intersection: a user who
 * can verify under a second, unrestricted residence keeps the destination
 * intent, because a bank level is still winnable for them.
 */
export const useBankRegionIntent = (): ((regionPath: string) => KYCRegionIntent) => {
    const { banking: isBankRestricted } = useResidenceRestrictions()

    return useCallback(
        (regionPath: string) => (isBankRestricted ? 'ROW' : getRegionIntent(regionPath)),
        [isBankRestricted]
    )
}
