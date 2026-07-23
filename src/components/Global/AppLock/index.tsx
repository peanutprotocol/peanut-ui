'use client'

/**
 * Native app lock. Wraps the app on cold start and whenever it returns from
 * more than LOCK_AFTER_BACKGROUND_MS in the background, so a session that
 * outlives the user's attention doesn't hand the account to whoever picks the
 * phone up next.
 *
 * Two regimes, decided by the token-storage mode (getSessionMode):
 *
 * 'guarded' — the session JWT lives in biometric-guarded Keychain/Keystore
 * (issue #2472). The unlock ceremony IS the token read: one OS biometric
 * prompt releases the credential into memory. The lock decision derives from
 * the guarded token's existence alone — never from the user query, which
 * cannot resolve while locked (its request parks on authReady) — and it fails
 * CLOSED: stripping local preferences yields a signed-out app, not an open
 * session. While locked, the in-memory token is dropped and the authenticated
 * session is paused (user query disabled, poller skipped, API callers parked).
 *
 * 'plain' — legacy deterrent gate for binaries without the plugin or devices
 * without enrolled biometrics: a local WebAuthn assertion guards rendering
 * only, with the old fail-open semantics. After it opens we opportunistically
 * migrate the session into guarded storage.
 *
 * It is a gate, not an overlay: while locked, the protected tree is not
 * rendered at all. Web is unaffected.
 */

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { isCapacitor } from '@/utils/capacitor'
import { getUserPreferences } from '@/utils/general.utils'
import { LOCK_AFTER_BACKGROUND_MS, requestLocalUserPresence } from '@/utils/app-lock'
import { setLockState } from '@/utils/app-lock-state'
import {
    getSessionMode,
    migratePlainToGuarded,
    suspendAuthSession,
    unlockGuardedToken,
    type SessionMode,
} from '@/utils/auth-token'

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
    const t = useTranslations('appLock')
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-white px-6">
            <div className="text-center">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <p className="mt-2 text-sm text-grey-1">{failed ? t('promptFailed') : t('prompt')}</p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-3">
                <Button variant="purple" shadowSize="4" loading={unlocking} onClick={onUnlock}>
                    {t('unlock')}
                </Button>
                <Button variant="stroke" shadowSize="4" onClick={onLogout}>
                    {t('logOut')}
                </Button>
            </div>
        </div>
    )
}

export function AppLockGate({ children }: { children: React.ReactNode }) {
    const { user, isFetchingUser, logoutUser } = useAuth()
    const t = useTranslations('appLock')
    const userId = user?.user.userId
    const [state, setState] = useState<GateState>('open')
    const [mode, setMode] = useState<SessionMode | null>(null)
    const [unlocking, setUnlocking] = useState(false)
    const [failed, setFailed] = useState(false)
    const backgroundedAt = useRef<number | null>(null)

    const credentialId = userId ? getUserPreferences(userId)?.webAuthnKey?.authenticatorId : undefined

    // Close the gate on the first client paint, before anything protected can
    // render, then resolve the storage mode. Runs once — later transitions are
    // driven by resume or unlock.
    useEffect(() => {
        if (!isCapacitor()) return
        setState('pending')
        let cancelled = false
        void getSessionMode().then((detected) => {
            if (cancelled) return
            setMode(detected)
            if (detected === 'guarded') {
                // Lock straight away — deliberately NOT waiting for the user
                // query, which cannot settle while its request is parked
                // behind the lock. suspendAuthSession also pauses the
                // poller/query and arms the ready gate.
                suspendAuthSession()
                setState('locked')
            }
            // 'plain' stays 'pending' until auth settles (legacy flow below);
            // 'none' means nothing to protect.
            if (detected === 'none') setState('open')
        })
        return () => {
            cancelled = true
        }
    }, [])

    // Legacy (plain-mode) settle: lock iff there is a user with a promptable
    // credential — a gate we can't open would strand the user in their own app.
    useEffect(() => {
        if (mode !== 'plain' || state !== 'pending' || isFetchingUser) return
        if (userId && credentialId) {
            setLockState('locked')
            setState('locked')
        } else {
            setState('open')
        }
    }, [mode, state, isFetchingUser, userId, credentialId])

    const rerunModeDetection = useCallback(() => {
        setMode(null)
        setState('pending')
        void getSessionMode().then((detected) => {
            setMode(detected)
            if (detected === 'guarded') {
                suspendAuthSession()
                setState('locked')
            } else if (detected === 'none') {
                setState('open')
            }
        })
    }, [])

    const attemptUnlock = useCallback(async () => {
        setUnlocking(true)
        if (mode === 'guarded') {
            const result = await unlockGuardedToken(t('prompt'))
            setUnlocking(false)
            if (result === 'unlocked') {
                setFailed(false)
                setState('open')
            } else if (result === 'downgraded') {
                // interrupted migration: the guarded item is gone but a plain
                // token survives — fall back to the legacy flow
                rerunModeDetection()
            } else if (result === 'session-gone') {
                // biometric re-enrollment (or a stripped store) invalidated the
                // token; the session is already cleared — land on login, never
                // a lock that can't open
                window.location.href = '/setup'
            } else {
                setFailed(true)
            }
            return
        }
        const outcome = await requestLocalUserPresence(credentialId)
        setUnlocking(false)
        if (outcome === 'unlocked' || outcome === 'unsupported') {
            setFailed(false)
            setLockState('unlocked')
            setState('open')
            void migratePlainToGuarded()
            return
        }
        setFailed(true)
    }, [mode, credentialId, rerunModeDetection, t])

    useEffect(() => {
        if (!isCapacitor() || !mode || mode === 'none') return
        if (mode === 'plain' && (!userId || !credentialId)) return

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
                        // Guarded: drop the token and re-arm the request gate
                        // synchronously, BEFORE the lock renders — a
                        // focus-triggered refetch must park, not race out with
                        // the old token.
                        if (mode === 'guarded') suspendAuthSession()
                        else setLockState('locked')
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
    }, [mode, userId, credentialId])

    // Prompt as soon as the gate closes, so the common case is one Face ID
    // prompt and no taps at all.
    useEffect(() => {
        if (state === 'locked' && !unlocking && !failed) void attemptUnlock()
        // Deliberately keyed on `state` alone: including attemptUnlock or the
        // transient flags would re-fire the prompt in a loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state])

    if (state === 'open') return <>{children}</>

    // 'pending': storage mode / auth hasn't settled, so we don't yet know
    // whether to prompt. Show the bare cover rather than the "locked" copy,
    // which would be a lie for a signed-out user about to be let straight
    // through.
    if (state === 'pending') return <div className="fixed inset-0 z-[9999] bg-white" />

    return (
        <LockScreen
            failed={failed}
            unlocking={unlocking}
            onUnlock={() => void attemptUnlock()}
            // Guarded + locked: there is no token in memory, so a backend
            // logout call would park on the ready gate forever — local wipe
            // only. The guarded JWT is deleted with it; tokenVersion is not
            // bumped, which is acceptable since the attacker can't extract the
            // guarded token anyway.
            onLogout={() => void logoutUser(mode === 'guarded' ? { skipBackendCall: true } : undefined)}
        />
    )
}
