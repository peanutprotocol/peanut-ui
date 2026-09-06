'use client'

import { formatRunningVersion, getRunningVersion } from '@/utils/app-version'
import { useEffect, useState } from 'react'

/**
 * What to print as "the app version".
 *
 * Native reports the release version of the code actually running — the OTA
 * bundle when one is applied, otherwise the binary — plus the binary's build
 * number (see `formatRunningVersion`). The bundled fallback only stands in
 * until the bridge answers, and on web, where package.json's version is the
 * only version there is.
 */
export function useAppVersion(fallback: string): string {
    const [version, setVersion] = useState(fallback)

    useEffect(() => {
        let cancelled = false
        void getRunningVersion().then((info) => {
            if (info && !cancelled) setVersion(formatRunningVersion(info))
        })
        return () => {
            cancelled = true
        }
    }, [])

    return version
}
