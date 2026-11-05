'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { rainApi, type RainCardOverview } from '@/services/rain'
import { getClearEpoch } from '@/utils/auth-token'

type Action = NonNullable<RainCardOverview['pendingVerification']>
type VerificationContext = RainCardOverview['verificationContext']
type Session = { key: string; owner: string; action: Action; token: string; revision: number; authEpoch: number }

function actionKey(owner: string | undefined, action: Action | undefined): string | null {
    if (
        !owner ||
        !action ||
        action.kind !== 'card_addon' ||
        typeof action.generation !== 'string' ||
        !action.generation ||
        action.generation.length > 64 ||
        typeof action.entryScope !== 'string' ||
        !/^[a-f0-9]{64}$/.test(action.entryScope)
    )
        return null
    return JSON.stringify([owner, action.generation, action.entryScope])
}

/** A card add-on session is separate from card application and issuance. */
export function useCardVerificationContinuation(
    owner: string | undefined,
    action: Action | undefined,
    verificationContext: VerificationContext,
    refreshOverview: () => void,
    refreshProfile: () => Promise<unknown>
) {
    const authEpoch = getClearEpoch()
    const actionIdentity = actionKey(owner, action)
    const last = useRef<{ owner: string | undefined; authEpoch: number; identity: string | null } | null>(null)
    let identity: string | null
    if (verificationContext?.status === 'none') identity = null
    else if (verificationContext?.status === 'open' || verificationContext?.status === 'checking') {
        identity = actionKey(owner, { kind: 'card_addon', ...verificationContext })
    } else if (actionIdentity) identity = actionIdentity
    else {
        const previous = last.current
        identity = previous && previous.owner === owner && previous.authEpoch === authEpoch ? previous.identity : null
    }
    last.current = { owner, authEpoch, identity }
    const key = identity === null ? null : JSON.stringify([identity, authEpoch])
    const canStart =
        (!verificationContext || verificationContext.status === 'open') &&
        !!key &&
        !!actionIdentity &&
        actionIdentity === identity
    const context = useRef({ key, authEpoch, revision: 0 })
    if (context.current.key !== key || context.current.authEpoch !== authEpoch)
        context.current = { key, authEpoch, revision: context.current.revision + 1 }
    const renderedRevision = context.current.revision
    const renderKey = key && JSON.stringify([key, renderedRevision])
    const currentSession = useRef<Session | null>(null)
    const inFlight = useRef<AbortController | null>(null)
    const alive = useRef(true)
    const [session, setSession] = useState<Session | null>(null)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [errorKey, setErrorKey] = useState<string | null>(null)

    useEffect(() => {
        alive.current = true
        return () => {
            alive.current = false
            inFlight.current?.abort()
            inFlight.current = null
        }
    }, [])
    useEffect(() => {
        return () => {
            inFlight.current?.abort()
            inFlight.current = null
            currentSession.current = null
        }
    }, [key, authEpoch])

    const start = useCallback(async () => {
        if (!canStart || !key || !owner || !action || inFlight.current || currentSession.current || context.current.key !== key ||
            context.current.revision !== renderedRevision ||
            getClearEpoch() !== context.current.authEpoch) return
        const controller = new AbortController()
        const revision = context.current.revision
        const capturedAuthEpoch = getClearEpoch()
        inFlight.current = controller
        setBusyKey(renderKey)
        setErrorKey(null)
        try {
            const token = await rainApi.resumeVerification(
                owner,
                action.entryScope,
                action.generation,
                controller.signal
            )
            if (!alive.current || controller.signal.aborted || context.current.key !== key ||
                context.current.revision !== revision || getClearEpoch() !== capturedAuthEpoch) return
            const next = { key, owner, action, token, revision, authEpoch: capturedAuthEpoch }
            currentSession.current = next
            setSession(next)
        } catch {
            if (alive.current && !controller.signal.aborted && context.current.key === key &&
                context.current.revision === revision && getClearEpoch() === capturedAuthEpoch) setErrorKey(renderKey)
        } finally {
            if (inFlight.current === controller) inFlight.current = null
            if (alive.current && context.current.key === key && context.current.revision === revision) setBusyKey(null)
        }
    }, [canStart, key, owner, action, renderedRevision, renderKey])

    const active = session?.key === key && session.revision === context.current.revision &&
        session.authEpoch === getClearEpoch() && currentSession.current === session ? session : null
    const refresh = useCallback(async () => {
        const captured = active
        if (!captured || currentSession.current !== captured || context.current.key !== captured.key ||
            context.current.revision !== captured.revision || getClearEpoch() !== captured.authEpoch)
            throw new Error('Card verification changed')
        const controller = new AbortController()
        inFlight.current?.abort()
        inFlight.current = controller
        try {
            const token = await rainApi.resumeVerification(
                captured.owner,
                captured.action.entryScope,
                captured.action.generation,
                controller.signal
            )
            if (
                !alive.current ||
                controller.signal.aborted ||
                context.current.key !== captured.key ||
                context.current.revision !== captured.revision ||
                getClearEpoch() !== captured.authEpoch ||
                currentSession.current !== captured
            )
                throw new Error('Card verification changed')
            return token
        } finally {
            if (inFlight.current === controller) inFlight.current = null
        }
    }, [active])

    const finish = useCallback(() => {
        if (!active || currentSession.current !== active || context.current.key !== active.key ||
            context.current.revision !== active.revision || getClearEpoch() !== active.authEpoch) return
        inFlight.current?.abort()
        inFlight.current = null
        currentSession.current = null
        setSession(null)
        refreshOverview()
        void refreshProfile().catch(() => undefined)
    }, [active, refreshOverview, refreshProfile])

    return {
        available: canStart,
        busy: !!renderKey && busyKey === renderKey,
        error: !!renderKey && errorKey === renderKey,
        start,
        active,
        refresh,
        finish,
    }
}
