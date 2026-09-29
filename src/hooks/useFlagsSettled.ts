'use client'

import posthog from 'posthog-js'
import { useEffect, useState } from 'react'

/** How long to wait for PostHog before acting on the flags we have. */
const FLAG_WAIT_MS = 4000

/**
 * Has PostHog delivered its flags yet?
 *
 * A flag read before they arrive is `undefined`, which every gate here turns
 * into `false`. That is the right default for showing a feature, and the wrong
 * one for a redirect: a user in the enabled cohort is sent away before the
 * answer lands. Wait for this first, and the redirect acts on a real `false`.
 *
 * The timeout is the other half — blocked analytics never call back, and a
 * page that waits forever is worse than one that acts on the default.
 */
export function useFlagsSettled(): boolean {
    const [settled, setSettled] = useState(false)

    useEffect(() => {
        const unsubscribe = posthog.onFeatureFlags(() => setSettled(true))
        const timeout = setTimeout(() => setSettled(true), FLAG_WAIT_MS)
        return () => {
            unsubscribe?.()
            clearTimeout(timeout)
        }
    }, [])

    return settled
}
