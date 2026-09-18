'use client'

import { useAuth } from '@/context/authContext'
import { readDeclaredResidence, readSecondResidence } from '@/utils/declared-residence.storage'
import { useMemo } from 'react'

/**
 * Every country this user counts as a resident of, upper-cased.
 *
 * The verified residence first, then the one they declared, then a second
 * declared residence — the same three the Unlock payments screen reads, and
 * the same device mirror for an API answer that predates the fields. A user
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
        return [residence?.verified, declared, second]
            .filter((iso2): iso2 is string => !!iso2)
            .map((iso2) => iso2.toUpperCase())
    }, [residence?.verified, residence?.declared, residence?.declaredSecond, userId])
}
