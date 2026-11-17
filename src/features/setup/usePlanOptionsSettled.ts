'use client'

import { useEffect, useState } from 'react'

/** How long 08 waits for the restriction lists once the intents read has failed (contract P3 § 4.6). */
export const PLAN_SETS_GRACE_MS = 2500

/**
 * Whether 08's options are known. They are when the server's intents arrived, or when the intents read failed and
 * the restriction lists arrived. The lists hook stays unsettled for good when `/config/residence-restrictions`
 * fails (it keeps nothing on the device), so once the intents read has failed and the lists have not come within
 * PLAN_SETS_GRACE_MS, the plan settles with the universal options (contract P3 § 4.6, review R2-03) instead of
 * waiting on "Loading…" with Continue off. Lists that arrive later still refine the options.
 */
export function usePlanOptionsSettled({
    intentsSettled,
    hasIntents,
    setsSettled,
}: {
    intentsSettled: boolean
    hasIntents: boolean
    setsSettled: boolean
}): boolean {
    const waitingOnSets = intentsSettled && !hasIntents && !setsSettled
    const [gaveUp, setGaveUp] = useState(false)
    useEffect(() => {
        if (!waitingOnSets) return
        const timer = setTimeout(() => setGaveUp(true), PLAN_SETS_GRACE_MS)
        return () => clearTimeout(timer)
    }, [waitingOnSets])
    return intentsSettled && (hasIntents || setsSettled || gaveUp)
}
