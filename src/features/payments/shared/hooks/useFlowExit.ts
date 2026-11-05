'use client'

import { useCallback } from 'react'
import { useAuth } from '@/context/authContext'
import { useReturnTo } from '@/hooks/useSafeBack'

/**
 * The exit of a payment flow's last screen: back past every entry the flow
 * pushed to `redirectTo` (or to /setup for a guest), then `onComplete`.
 *
 * Navigation goes first because `onComplete` may reset the flow's state and
 * unmount the screen. A push here kept the finished flow under home, so back
 * from home reopened it (QA-09).
 */
export function useFlowExit(redirectTo: string, onComplete?: () => void) {
    const { user } = useAuth()
    const leaveFlow = useReturnTo(user?.user.userId ? redirectTo : '/setup')
    return useCallback(() => {
        leaveFlow()
        onComplete?.()
    }, [leaveFlow, onComplete])
}
