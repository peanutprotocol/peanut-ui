'use client'

import posthog from 'posthog-js'
import { useEffect, useState } from 'react'
import { FORCE_UPDATE_FLOOR_FLAG } from './force-update'

/** The raw floor payload, read again each time PostHog loads flags. Undefined until then. */
export function useForceUpdateFloor(): unknown {
    const [floor, setFloor] = useState<unknown>(undefined)
    useEffect(
        () =>
            posthog.onFeatureFlags(() =>
                setFloor(posthog.getFeatureFlagResult(FORCE_UPDATE_FLOOR_FLAG, { send_event: false })?.payload)
            ),
        []
    )
    return floor
}
