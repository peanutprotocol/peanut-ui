'use client'

import { useCallback, useEffect, useState } from 'react'
import {
    COPY_REVIEW_STORAGE_KEY,
    parseCopyReviewState,
    serializeCopyReviewState,
    toggleCopyReview,
    type CopyReviewState,
} from './copyReviewStorage'

/**
 * Copy-review verdicts, persisted in localStorage so a review survives a reload
 * (and a closed laptop) without needing a backend. Deliberately local-only: this
 * is one reviewer's checklist, not shared state.
 *
 * Reads on mount rather than during render — the board is SSR'd, and a first
 * paint that already showed verdicts would hydrate-mismatch. Until `hydrated`
 * flips, every render reads as pending, which is the safe default.
 */
export function useCopyReview() {
    const [state, setState] = useState<CopyReviewState>({})
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
        setState(parseCopyReviewState(window.localStorage.getItem(COPY_REVIEW_STORAGE_KEY)))
        setHydrated(true)
    }, [])

    const persist = useCallback((next: CopyReviewState) => {
        setState(next)
        window.localStorage.setItem(COPY_REVIEW_STORAGE_KEY, serializeCopyReviewState(next))
    }, [])

    const toggle = useCallback((id: string) => persist(toggleCopyReview(state, id)), [persist, state])
    const reset = useCallback(() => persist({}), [persist])
    const isReviewed = useCallback((id: string) => hydrated && state[id] === true, [hydrated, state])

    return { state, hydrated, isReviewed, toggle, reset }
}
