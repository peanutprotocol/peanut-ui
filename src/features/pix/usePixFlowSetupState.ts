'use client'

import { useEffect, useState } from 'react'
import { pixSetupState, type PixSetupState } from '@/features/pix/pixRouteStep'
import { useCapabilities } from '@/hooks/useCapabilities'
import type { CapabilityRoute } from '@/types/capabilities'

/**
 * The setup state a Pix flow (add money, withdraw, a Pix-key send, a Pix QR payment) acts on. The
 * provider's terms gate the flow at its entry only (TASK-25073): once the flow has started, which is
 * once its route read ready, terms that a later capabilities read brings do not replace the screen
 * the user is on, and the next entry asks for them. Every other step (identity, the account the
 * first use opens, the wait) still takes over a running flow, as before.
 */
export function usePixFlowSetupState(route: CapabilityRoute | undefined): PixSetupState {
    const { nextActions } = useCapabilities()
    const state = pixSetupState(route, nextActions)
    const [started, setStarted] = useState(false)
    useEffect(() => {
        if (state === 'ready') setStarted(true)
    }, [state])
    return started ? pixSetupState(route, nextActions, { setAsideTerms: true }) : state
}
