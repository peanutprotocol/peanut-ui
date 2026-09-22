'use client'

import { useAuth } from '@/context/authContext'
import { readDeclaredResidence, readSecondResidence } from '@/utils/declared-residence.storage'
import { useMemo } from 'react'
import { gatingResidenceIso2s } from './residenceGate'

/**
 * Every country this user counts as a resident of, upper-cased.
 *
 * The verified residence (else the declared one) and a second declared
 * residence, through `gatingResidenceIso2s` — the derivation the Unlock
 * payments rows use too — with the device mirror for an API answer that
 * predates the fields. A user
 * with no answer at all resides nowhere, which closes the residence-gated
 * corridors rather than opening them.
 */
export function useResidenceIso2s(): string[] {
    const { user } = useAuth()
    const userId = user?.user?.userId
    const residence = user?.residence

    return useMemo(() => {
        // the server's answer wins whenever it sends the field, `null` included
        const second = residence?.declaredSecond === undefined ? readSecondResidence(userId) : residence.declaredSecond
        const declared = residence?.declared ?? readDeclaredResidence(userId)
        return gatingResidenceIso2s({ verified: residence?.verified, declared, second })
    }, [residence?.verified, residence?.declared, residence?.declaredSecond, userId])
}
