'use client'

// Wraps the two harness-only contexts (ReproduceBootstrap + HarnessReplay).
// Loaded via next/dynamic in ClientProviders.tsx only when HARNESS_ENABLED
// is true, so in prod builds the webpack chunk is never produced.

import { HarnessReplay } from './HarnessReplay'
import { ReproduceBootstrap } from './ReproduceBootstrap'

export function HarnessBootstrap() {
    return (
        <>
            <ReproduceBootstrap />
            <HarnessReplay />
        </>
    )
}
