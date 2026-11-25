'use client'

import { useEffect, useState } from 'react'
import { useOtaUpdate } from '@/context/OtaUpdateContext'
import type { StoreUpdatePlatform } from '@/utils/store-update'

/**
 * Once forced, stays forced for this app session. The store offer is checked
 * again on every resume and reads null until the check answers, so without
 * this the app would show for a moment each time the user comes back from the
 * store without updating. Installing the update restarts the app.
 */
export function useForcedUpdatePlatform(): StoreUpdatePlatform | null {
    const { forcedUpdatePlatform } = useOtaUpdate()
    const [platform, setPlatform] = useState(forcedUpdatePlatform)
    useEffect(() => {
        if (forcedUpdatePlatform) setPlatform(forcedUpdatePlatform)
    }, [forcedUpdatePlatform])
    return forcedUpdatePlatform ?? platform
}
