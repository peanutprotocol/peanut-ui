'use client'

import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { AVENIA_PIX_RAIL_ID, brazilPixPath, type BrazilPixPath } from '@/features/avenia/avenia.utils'
import { useAveniaUnavailable } from '@/features/avenia/aveniaAvailability'
import type { RailCapability } from '@/types/capabilities'

/**
 * Which provider serves this user's Brazilian Pix deposits and withdrawals:
 * Avenia for Brazilian residents, Manteca for everyone else. The rules are in
 * {@link brazilPixPath}.
 */
export function useAveniaPixPath(): { path: BrazilPixPath; rail: RailCapability | undefined } {
    const { user } = useAuth()
    const { getRail, isLoading } = useCapabilities()
    const { isVerified } = useIdentityVerification()
    const unavailable = useAveniaUnavailable(user?.user?.userId)
    const rail = getRail(AVENIA_PIX_RAIL_ID)
    const path = brazilPixPath({
        isLoading,
        aveniaRail: rail,
        identityVerified: isVerified,
        verifiedResidence: user?.residence?.verified?.country,
        unavailable,
    })
    return { path, rail }
}
