'use client'

import { useCallback } from 'react'
import { useAuth } from '@/context/authContext'
import { isStaleKeyError } from '@/utils/walletCredential.utils'

/**
 * Reactive stale-credential guard for sign-then-broadcast flows. The UserOp is
 * signed on the client and broadcast by the backend, so a wrong-passkey session
 * surfaces as an AA24 / `wapk` error in the API *response* rather than a thrown
 * client error — the access-point guard in KernelClientProvider never sees it
 * for migration accounts (their address is injected, not key-derived).
 *
 * A stale session can't recover by retrying; the only exit is a clean re-auth.
 * Pass the API error/message here: when it's a stale-credential error it forces
 * logout and returns true so the caller can stop.
 */
export const useStaleSessionGuard = () => {
    const { logoutUser } = useAuth()
    return useCallback(
        (error: unknown): boolean => {
            if (!isStaleKeyError(error)) return false
            logoutUser()
            return true
        },
        [logoutUser]
    )
}
