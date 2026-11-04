'use client'

import { useResidenceIso2s } from '@/features/deposit-accounts/useResidenceIso2s'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useAuth } from '@/context/authContext'
import { readSecondResidence } from '@/utils/declared-residence.storage'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { isBrazilServicesUser } from './brazilPause.utils'

/**
 * True when the Brazil pause is on and covers this user. Every BRL deposit,
 * withdraw and Pix entry then shows the paused drawer or screen instead of
 * its flow. The `brazilServicesPaused` kill switch starts and ends the pause.
 */
export function useBrazilServicesPaused(): boolean {
    const { brazilServicesPaused } = useKillSwitches()
    const residenceIso2s = useResidenceIso2s()
    const { user } = useAuth()
    const localSecond = useHydrationSnapshot(
        () => readSecondResidence(user?.user?.userId),
        () => null
    )
    // KYC account gates use only the primary residence. The production pause
    // also covers a second declared Brazil residence (TASK-24197).
    const serverSecond = user?.residence?.secondaryDeclaredCountry
    const second = serverSecond === undefined ? localSecond : serverSecond
    const { operationStatus } = useCapabilities()
    return (
        brazilServicesPaused &&
        isBrazilServicesUser(second ? [...residenceIso2s, second.toUpperCase()] : residenceIso2s, operationStatus)
    )
}
