'use client'

import { useCallback, useEffect, useRef } from 'react'
import { getAuthToken, getClearEpoch, tokenUserId } from '@/utils/auth-token'
import { isDemoMode } from '@/utils/demo'

export interface SessionFence {
    userId: string | null
    current: () => boolean
}

/** Bind an asynchronous intent to its authenticated account and mounted owner. */
export function useSessionFence() {
    const lifetime = useRef(0)
    useEffect(
        () => () => {
            lifetime.current += 1
        },
        []
    )
    return useCallback((): SessionFence => {
        const demo = isDemoMode()
        // Demo preference writes stay in the synthetic API; a missing real JWT
        // never becomes permission to write to an authenticated account.
        const userId = demo ? 'demo-user' : tokenUserId(getAuthToken())
        const epoch = getClearEpoch()
        const owner = lifetime.current
        return {
            userId,
            current: () =>
                !!userId &&
                lifetime.current === owner &&
                getClearEpoch() === epoch &&
                isDemoMode() === demo &&
                (demo || tokenUserId(getAuthToken()) === userId),
        }
    }, [])
}
