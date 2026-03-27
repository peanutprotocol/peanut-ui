'use client'

import { useCallback, useState } from 'react'
import { useBridgeTosStatus } from './useBridgeTosStatus'

/**
 * encapsulates the just-in-time bridge TOS acceptance pattern.
 * returns a guard function that checks TOS status before proceeding,
 * plus the state/handlers needed to render BridgeTosStep.
 *
 * usage:
 *   const { guardWithTos, tosProps } = useBridgeTosGuard()
 *
 *   const handleSubmit = () => {
 *       if (guardWithTos()) return // shows TOS, will call onRetry when accepted
 *       doTheActualThing()
 *   }
 *
 *   <BridgeTosStep {...tosProps} onComplete={() => { tosProps.onComplete(); handleSubmit() }} />
 */
export function useBridgeTosGuard() {
    const { needsBridgeTos } = useBridgeTosStatus()
    const [showBridgeTos, setShowBridgeTos] = useState(false)

    /** returns true if TOS is needed (and shows the modal). caller should return early. */
    const guardWithTos = useCallback(() => {
        if (needsBridgeTos) {
            setShowBridgeTos(true)
            return true
        }
        return false
    }, [needsBridgeTos])

    const hideTos = useCallback(() => setShowBridgeTos(false), [])

    return {
        guardWithTos,
        showBridgeTos,
        hideTos,
        needsBridgeTos,
    }
}
