'use client'

import { Banner } from '@/components/Global/Banner'
import { useHasNavHeader } from '@/components/Global/Banner/navHeaderPresence'

/**
 * Top-of-shell maintenance banner for headerless states only. When the page
 * mounts a NavHeader, that header carries the banner (below the header row,
 * per the 2026-09-03 placement ruling) and this renders nothing.
 */
export function ShellBannerFallback() {
    const hasNavHeader = useHasNavHeader()
    if (hasNavHeader) return null
    return <Banner />
}
