'use client'

import { useAuth } from '@/context/authContext'
import { readDeclaredResidence } from '@/utils/declared-residence.storage'
import { useMemo } from 'react'
import { gatingResidenceIso2s } from './residenceGate'
import { useHydrationSnapshot } from '@/utils/native-platform'

/**
 * The country a residence gate reads for this user, upper-cased.
 *
 * The verified residence, else the declared one, through
 * `gatingResidenceIso2s` — the derivation the Unlock payments rows use too —
 * with the device mirror for an API answer that predates the fields. A user
 * with no answer at all resides nowhere, which closes the residence-gated
 * corridors rather than opening them.
 */
export function useResidenceIso2s(): string[] {
    const { user } = useAuth()
    const userId = user?.user?.userId
    const residence = user?.residence
    const localDeclared = useHydrationSnapshot(
        () => readDeclaredResidence(userId),
        () => null
    )

    return useMemo(
        () =>
            gatingResidenceIso2s({
                verified: residence?.verified?.country,
                declared: residence?.declared?.country ?? localDeclared,
            }),
        [residence?.verified?.country, residence?.declared?.country, localDeclared]
    )
}
