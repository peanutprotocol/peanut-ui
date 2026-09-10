import { useEffect, useRef } from 'react'
import { captureBadgeShareShown } from './badge.utils'

/**
 * Fires the badge-share impression once per OPEN, not per username change — the
 * handle can resolve mid-open (user-query hydration), and re-firing would count one
 * exposure twice, split across two link_type buckets.
 */
export function useBadgeShareImpression(isOpen: boolean, source: string, username: string | null | undefined): void {
    const latched = useRef(false)
    useEffect(() => {
        if (!isOpen) {
            latched.current = false
            return
        }
        if (latched.current) return
        latched.current = true
        captureBadgeShareShown(source, username)
    }, [isOpen, source, username])
}
