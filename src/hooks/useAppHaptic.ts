'use client'

import { useCallback } from 'react'
import { useHaptic } from 'use-haptic'
import { isCapacitor } from '@/utils/capacitor'
import { impactHaptic, WEB_TAP_MS } from '@/utils/haptics'

/**
 * Drop-in replacement for use-haptic's useHaptic().
 *
 * use-haptic is a web-only library and does nothing on either native platform.
 * On iOS it clicks a hidden `<input switch>` label — a Safari-app behaviour that
 * a display:none control inside a WKWebView never actuates. On Android it calls
 * navigator.vibrate(5), which is too short for the motor to produce anything
 * felt. Native goes through the real Taptic/vibration engine instead.
 *
 * Web keeps use-haptic, because on iOS web the switch trick is the only haptic
 * available at all (no Vibration API), but at a duration that can be felt.
 */
export function useAppHaptic(): { triggerHaptic: () => void } {
    const { triggerHaptic: triggerWebHaptic } = useHaptic(WEB_TAP_MS)

    const triggerHaptic = useCallback(() => {
        if (isCapacitor()) {
            impactHaptic()
            return
        }
        triggerWebHaptic()
    }, [triggerWebHaptic])

    return { triggerHaptic }
}

export default useAppHaptic
