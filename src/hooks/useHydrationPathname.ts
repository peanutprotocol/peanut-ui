'use client'

import { usePathname, useSelectedLayoutSegments } from 'next/navigation'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/** Root-layout providers only: selected segments are relative to the enclosing layout. */
export function useHydrationPathname(): string | null {
    const pathname = usePathname()
    const segments: string[] | null = useSelectedLayoutSegments()
    const serverPathname =
        segments === null
            ? null
            : '/' + segments.filter((segment) => !(segment.startsWith('(') && segment.endsWith(')'))).join('/')

    return useSyncExternalStore(
        subscribe,
        () => pathname,
        () => serverPathname
    )
}
