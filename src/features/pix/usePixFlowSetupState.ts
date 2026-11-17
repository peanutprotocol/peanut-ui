'use client'

import { useEffect, useState } from 'react'
import { pixSetupState, type PixSetupState } from '@/features/pix/pixRouteStep'
import { useCapabilities } from '@/hooks/useCapabilities'
import type { CapabilityRoute } from '@/types/capabilities'

/**
 * The setup state a Pix flow (add money, withdraw, a Pix-key send, a Pix QR payment) acts on. The
 * provider's terms (TASK-25073) gate each attempt at its start: they never replace the screens of a
 * payment already opened (`paymentOpened`), nor a form that started with the route ready, and every
 * new attempt asks for them. An attempt ends when its opened payment closes (Start new deposit, Try
 * again); a Pix QR payment is one attempt per scan, as the page mounts anew. Every other step
 * (identity, the account the first use opens, the wait) still takes over a running flow, as before.
 */
export function usePixFlowSetupState(route: CapabilityRoute | undefined, paymentOpened: boolean): PixSetupState {
    const { nextActions } = useCapabilities()
    const state = pixSetupState(route, nextActions)
    const [started, setStarted] = useState(false)
    // the opened payment closed: the next attempt starts, and asks for the terms
    const [wasOpened, setWasOpened] = useState(paymentOpened)
    if (wasOpened !== paymentOpened) {
        setWasOpened(paymentOpened)
        if (!paymentOpened) setStarted(false)
    }
    useEffect(() => {
        if (state === 'ready' && !started) setStarted(true)
    }, [state, started])
    return started || paymentOpened ? pixSetupState(route, nextActions, { setAsideTerms: true }) : state
}
