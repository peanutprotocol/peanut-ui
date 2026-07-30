'use client'

/**
 * Native app lock. Wraps the app on cold start and whenever it returns from
 * more than LOCK_AFTER_BACKGROUND_MS in the background, so a session that
 * outlives the user's attention doesn't hand the account to whoever picks the
 * phone up next.
 *
 * It is a gate, not an overlay: while locked, the protected tree is not
 * rendered at all. Nothing paints behind the lock screen and nothing back
 * there is focusable or reachable by assistive tech. The cost is that
 * remounting on unlock loses in-flight component state — acceptable, since the
 * lock only fires on cold start (no state yet) or after five minutes
 * backgrounded (where iOS has often discarded the webview anyway).
 *
 * Web is unaffected — there is no OS-backed presence check to lean on there,
 * and a browser tab has no equivalent of "resumed from background".
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { isCapacitor } from '@/utils/capacitor'
import { getUserPreferences } from '@/utils/general.utils'
import { LOCK_AFTER_BACKGROUND_MS, requestLocalUserPresence } from '@/utils/app-lock'

/**
 * `pending` is the state that makes this a boundary rather than a curtain: on
 * native we enter it on the very first client paint, before the user query can
 * resolve and render balances. Only once auth settles do we learn whether this
 * becomes `locked` or, for a signed-out user or one with no usable credential,
 * `open`.
 */
type GateState = 'open' | 'pending' | 'locked'

function LockScreen({
    failed,
    unlocking,
    onUnlock,
    onLogout,
}: {
    failed: boolean
    unlocking: boolean
    onUnlock: () => void
    onLogout: () => void
}) {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-white px-6">
            <div className="text-center">
                <h1 className="text-2xl font-bold">Welcome back!</h1>
                <p className="mt-2 text-sm text-grey-1">
                    {failed ? 'Please log in again to access the app.' : 'Please log in to access the app.'}
                </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-3">
                <Button variant="purple" shadowSize="4" loading={unlocking} onClick={onUnlock}>
                    Log in
                </Button>
                <Button variant="stroke" shadowSize="4" onClick={onLogout}>
                    Log out
                </Button>
            </div>
        </div>
    )
}

export function AppLockGate({ children }: { children: React.ReactNode }) {
    const { user, isFetchingUser, logoutUser } = useAuth()
    const userId = user?.user.userId
    const [state, setState] = useState<GateState>('open')
    const [unlocking, setUnlocking] = useState(false)
    const [failed, setFailed] = useState(false)
    const backgroundedAt = useRef<number | null>(null)

    const credentialId = userId ? getUserPreferences(userId)?.webAuthnKey?.authenticatorId : undefined

    // Close the gate on the first client paint, before anything protected can
    // render. Runs once — later transitions are driven by resume or unlock.
    useEffect(() => {
        if (isCapacitor()) setState('pending')
    }, [])

    useEffect(() => {
        if (state !== 'pending' || isFetchingUser) return
        // Nothing to protect, or no credential we could ever prompt against —
        // a gate we can't open would strand the user in their own app.
        setState(userId && credentialId ? 'locked' : 'open')
    }, [state, isFetchingUser, userId, credentialId])

    const attemptUnlock = useCallback(async () => {
        setUnlocking(true)
        const outcome = await requestLocalUserPresence(credentialId)
        setUnlocking(false)
        if (outcome === 'unlocked' || outcome === 'unsupported') {
            setFailed(false)
            setState('open')
            return
        }
        setFailed(true)
    }, [credentialId])

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
                        setFailed(false)
                        setState('locked')
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
                // resume-locking is unavailable. Cold-start locking still works.
            })

        return () => {
            cancelled = true
            removeListener?.()
        }
    }, [userId, credentialId])

    // Prompt as soon as the gate closes, so the common case is one Face ID
    // prompt and no taps at all.
    useEffect(() => {
        if (state === 'locked' && !unlocking && !failed) void attemptUnlock()
        // Deliberately keyed on `state` alone: including attemptUnlock or the
        // transient flags would re-fire the prompt in a loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state])

    if (state === 'open') return <>{children}</>

    // 'pending': auth hasn't settled, so we don't yet know whether to prompt.
    // Show the bare cover rather than the "locked" copy, which would be a lie
    // for a signed-out user about to be let straight through.
    if (state === 'pending') return <div className="fixed inset-0 z-[9999] bg-white" />

    return (
        <LockScreen
            failed={failed}
            unlocking={unlocking}
            onUnlock={() => void attemptUnlock()}
            onLogout={() => void logoutUser()}
        />
    )
}
