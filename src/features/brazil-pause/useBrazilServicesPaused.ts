'use client'

import { useResidenceIso2s } from '@/features/deposit-accounts/useResidenceIso2s'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { useCapabilities } from '@/hooks/useCapabilities'
import { isBrazilServicesUser } from './brazilPause.utils'

/**
 * True when the Brazil pause is on and covers this user. Every BRL deposit,
 * withdraw and Pix entry then shows the paused drawer or screen instead of
 * its flow. The `brazilServicesPaused` kill switch starts and ends the pause.
 */
export function useBrazilServicesPaused(): boolean {
    const { brazilServicesPaused } = useKillSwitches()
    const residenceIso2s = useResidenceIso2s()
    const { operationStatus } = useCapabilities()
    return brazilServicesPaused && isBrazilServicesUser(residenceIso2s, operationStatus)
}
