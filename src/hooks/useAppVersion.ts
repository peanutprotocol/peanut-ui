'use client'

import { formatBinaryVersion, getBinaryInfo } from '@/utils/app-version'
import { useEffect, useState } from 'react'

/**
 * What to print as "the app version".
 *
 * Native reports what the binary actually ships, as `<major>.<minor>.<build>`
 * (see `formatBinaryVersion`); the bundled fallback only stands in until the
 * bridge answers, and on web, where package.json's version is the only version
 * there is.
 */
export function useAppVersion(fallback: string): string {
    const [version, setVersion] = useState(fallback)

    useEffect(() => {
        let cancelled = false
        void getBinaryInfo().then((info) => {
            if (info && !cancelled) setVersion(formatBinaryVersion(info))
        })
        return () => {
            cancelled = true
        }
    }, [])

    return version
}
