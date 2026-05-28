'use client'

import { useCallback, useState } from 'react'
import { useCapabilities } from './useCapabilities'

/**
 * Encapsulates the just-in-time terms-of-service acceptance pattern for bank
 * rails. Returns a guard function the caller invokes before an action; if the
 * user still needs to accept ToS, the guard renders the ToS step and short-
 * circuits the action.
 *
 * Provider-blind: reads the capability gate's `accept-tos` state — the BE
 * resolver decides which rails need a ToS (today only Bridge bank rails, via a
 * `kind: 'accept-tos'` nextAction). The FE doesn't enumerate providers.
 *
 * Usage:
 *   const { guardWithTos, showBridgeTos, hideTos } = useTosGuard()
 *
 *   const handleSubmit = () => {
 *       if (guardWithTos()) return // shows ToS, caller returns early
 *       doTheActualThing()
 *   }
 */
export function useTosGuard() {
    const { gateFor } = useCapabilities()
    const needsTos = gateFor('deposit', { channel: 'bank' }).kind === 'accept-tos'
    const [showBridgeTos, setShowBridgeTos] = useState(false)

    /** Returns true if ToS is needed (and shows the step). Caller returns early. */
    const guardWithTos = useCallback(() => {
        if (needsTos) {
            setShowBridgeTos(true)
            return true
        }
        return false
    }, [needsTos])

    const hideTos = useCallback(() => setShowBridgeTos(false), [])

    return {
        guardWithTos,
        showBridgeTos,
        hideTos,
        needsTos,
    }
}
