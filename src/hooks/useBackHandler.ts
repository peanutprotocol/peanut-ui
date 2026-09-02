import { useEffect, useLayoutEffect, useRef } from 'react'
import { registerBackHandler, type BackHandler } from '@/utils/back-handler'

/**
 * Registers `handler` on the hardware-back stack while `enabled`. The stack
 * position is fixed at the moment `enabled` flips true; the latest handler is
 * always the one invoked, so callers can pass an inline closure.
 */
export function useBackHandler(handler: BackHandler, enabled = true) {
    const handlerRef = useRef(handler)
    useLayoutEffect(() => {
        handlerRef.current = handler
    })

    useEffect(() => {
        if (!enabled) return
        return registerBackHandler(() => handlerRef.current())
    }, [enabled])
}
