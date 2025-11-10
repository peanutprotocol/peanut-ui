'use client'

import { useEffect, useRef } from 'react'

interface UseInfiniteScrollOptions {
    hasNextPage: boolean
    isFetchingNextPage: boolean
    fetchNextPage: () => void
    enabled?: boolean // optional flag to disable infinite scroll (e.g., when searching)
    threshold?: number // intersection observer threshold
}

/**
 * custom hook for viewport-based infinite scroll using intersection observer
 * abstracts the common pattern used across history, contacts, etc.
 */
export function useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    enabled = true,
    threshold = 0.1,
}: UseInfiniteScrollOptions) {
    const loaderRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // skip if disabled
        if (!enabled) return

        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0]
                // trigger fetchNextPage when loader comes into view
                if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage()
                }
            },
            {
                threshold,
            }
        )

        const currentLoaderRef = loaderRef.current
        if (currentLoaderRef) {
            observer.observe(currentLoaderRef)
        }

        return () => {
            if (currentLoaderRef) {
                observer.unobserve(currentLoaderRef)
            }
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage, enabled, threshold])

    return { loaderRef }
}
