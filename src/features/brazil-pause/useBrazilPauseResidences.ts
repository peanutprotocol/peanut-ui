'use client'

import { useResidenceIso2s } from '@/features/deposit-accounts/useResidenceIso2s'
import { useAuth } from '@/context/authContext'
import { readSecondResidence } from '@/utils/declared-residence.storage'
import { useHydrationSnapshot } from '@/utils/native-platform'

/**
 * The residences the Brazil pause reads, upper-cased: the gating residence and
 * a second declared one. KYC account gates use only the primary residence. The
 * production pause also covers a second declared Brazil residence (TASK-24197).
 */
export function useBrazilPauseResidences(): string[] {
    const residenceIso2s = useResidenceIso2s()
    const { user } = useAuth()
    const localSecond = useHydrationSnapshot(
        () => readSecondResidence(user?.user?.userId),
        () => null
    )
    const serverSecond = user?.residence?.secondaryDeclaredCountry
    const second = serverSecond === undefined ? localSecond : serverSecond
    return second ? [...residenceIso2s, second.toUpperCase()] : residenceIso2s
}
