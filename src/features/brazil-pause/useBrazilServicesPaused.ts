'use client'

import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { useCapabilities } from '@/hooks/useCapabilities'
import { isBrazilServicesUser } from './brazilPause.utils'
import { useBrazilPauseResidences } from './useBrazilPauseResidences'

/**
 * True when the Brazil pause is on and covers this user. Every BRL deposit and
 * withdraw entry then shows the paused drawer or screen instead of its flow;
 * Pix entries read `useBrazilPixPaused`. The `brazilServicesPaused` kill switch
 * starts and ends the pause.
 */
export function useBrazilServicesPaused(): boolean {
    const { brazilServicesPaused } = useKillSwitches()
    const residenceIso2s = useBrazilPauseResidences()
    const { operationStatus } = useCapabilities()
    return brazilServicesPaused && isBrazilServicesUser(residenceIso2s, operationStatus)
}
