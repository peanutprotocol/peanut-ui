'use client'

/**
 * Native app lock. Covers the app with a biometric gate on cold start and
 * whenever it returns from more than LOCK_AFTER_BACKGROUND_MS in the
 * background, so a session that outlives the user's attention doesn't hand the
 * account to whoever picks the phone up next.
 *
 * Web is unaffected — there is no OS-backed presence check to lean on there,
 * and the browser tab has no equivalent of "resumed from background".
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { isCapacitor } from '@/utils/capacitor'
import { getUserPreferences } from '@/utils/general.utils'
import { LOCK_AFTER_BACKGROUND_MS, requestLocalUserPresence } from '@/utils/app-lock'

export function AppLockGate() {
    const { user, logoutUser } = useAuth()
    const userId = user?.user.userId
    const [locked, setLocked] = useState(false)
    const [unlocking, setUnlocking] = useState(false)
    const [failed, setFailed] = useState(false)
    const backgroundedAt = useRef<number | null>(null)
    // Cold-start lock must fire once per launch, not on every login state change.
    const coldStartHandled = useRef(false)

    const credentialId = userId ? getUserPreferences(userId)?.webAuthnKey?.authenticatorId : undefined

    const attemptUnlock = useCallback(async () => {
        setUnlocking(true)
        const outcome = await requestLocalUserPresence(credentialId)
        setUnlocking(false)
        // 'unsupported' means we can never raise this lock — never leave the
        // user staring at a gate with no key.
        if (outcome === 'unlocked' || outcome === 'unsupported') {
            setLocked(false)
            setFailed(false)
            return
        }
        setFailed(true)
    }, [credentialId])

    useEffect(() => {
        if (!isCapacitor() || !userId || coldStartHandled.current) return
        coldStartHandled.current = true
        if (!credentialId) return
        setLocked(true)
    }, [userId, credentialId])

    useEffect(() => {
        if (!isCapacitor() || !userId || !credentialId) return

        let removeListener: (() => void) | undefined
        let cancelled = false

        import('@capacitor/app')
            .then(({ App }) =>
                App.addListener('appStateChange', ({ isActive }) => {
                    if (!isActive) {
                        backgroundedAt.current = Date.now()
                        return
                    }
                    const since = backgroundedAt.current
                    backgroundedAt.current = null
                    if (since !== null && Date.now() - since > LOCK_AFTER_BACKGROUND_MS) {
                        setLocked(true)
                        setFailed(false)
                    }
                })
            )
            .then((handle) => {
                if (cancelled) {
                    handle.remove()
                    return
                }
                removeListener = () => handle.remove()
            })
            .catch(() => {
                // No @capacitor/app bridge (web bundle, or an old native shell):
                // resume-locking is simply unavailable. Cold-start lock still works.
            })

        return () => {
            cancelled = true
            removeListener?.()
        }
    }, [userId, credentialId])

    // Auto-prompt as soon as the gate goes up, so the common case is one Face ID
    // prompt and no taps at all.
    useEffect(() => {
        if (locked && !unlocking && !failed) void attemptUnlock()
        // attemptUnlock is stable for a given credential; re-running on every
        // render would re-prompt in a loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locked])

    if (!locked) return null

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-white px-6">
            <div className="text-center">
                <h1 className="text-2xl font-bold">Peanut is locked</h1>
                <p className="mt-2 text-sm text-grey-1">
                    {failed ? 'Could not confirm it is you. Try again to continue.' : 'Confirm it is you to continue.'}
                </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-3">
                <Button variant="purple" shadowSize="4" loading={unlocking} onClick={() => void attemptUnlock()}>
                    Unlock
                </Button>
                <Button variant="stroke" shadowSize="4" onClick={() => void logoutUser()}>
                    Log out
                </Button>
            </div>
        </div>
    )
}
