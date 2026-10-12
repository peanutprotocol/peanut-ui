'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorStatus } from '@/services/api-error'
import { shakeApi, type ShakeCandidate, type ShakeLocation } from './shakeApi'

export type ShakeSearchState = 'idle' | 'searching' | 'expired' | 'error' | 'rate-limited'

export const SHAKE_POLL_INTERVAL_MS = 1500
export const SHAKE_MAX_POLL_FAILURES = 3

function retryAfterOf(error: unknown): number | null {
    const value = (error as { retryAfterSec?: unknown } | null)?.retryAfterSec
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.ceil(value) : null
}

function cancelQuietly(sessionId: string) {
    shakeApi.cancelSession(sessionId).catch(() => {})
}

/**
 * One shake = one server session. Every shake, stop, unmount or backgrounding
 * bumps `generation`; any response that comes back for an older generation is
 * dropped (and its session cancelled), so a slow reply can never overwrite the
 * current search or make the user discoverable after they left.
 */
export function useShakeSession() {
    const [state, setState] = useState<ShakeSearchState>('idle')
    const [candidates, setCandidates] = useState<ShakeCandidate[]>([])
    const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null)

    const generation = useRef(0)
    const sessionId = useRef<string | null>(null)
    const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Creates run one at a time so the server sees them in the order the user shook;
    // otherwise an older create landing last would cancel the newer session.
    const creating = useRef<Promise<unknown>>(Promise.resolve())
    const mounted = useRef(false)

    const clearPoll = useCallback(() => {
        if (pollTimer.current) clearTimeout(pollTimer.current)
        pollTimer.current = null
    }, [])

    const releaseSession = useCallback(() => {
        const id = sessionId.current
        sessionId.current = null
        if (id) cancelQuietly(id)
    }, [])

    const isCurrent = useCallback((gen: number) => mounted.current && gen === generation.current, [])

    const schedulePoll = useCallback(
        (gen: number, id: string, failures: number) => {
            pollTimer.current = setTimeout(async () => {
                try {
                    const session = await shakeApi.getSession(id)
                    if (!isCurrent(gen)) return
                    if (session.status !== 'active') {
                        sessionId.current = null
                        setCandidates([])
                        setState('expired')
                        return
                    }
                    setCandidates(session.candidates)
                    schedulePoll(gen, id, 0)
                } catch {
                    if (!isCurrent(gen)) return
                    if (failures + 1 >= SHAKE_MAX_POLL_FAILURES) {
                        setState('error')
                        return
                    }
                    schedulePoll(gen, id, failures + 1)
                }
            }, SHAKE_POLL_INTERVAL_MS)
        },
        [isCurrent]
    )

    const stop = useCallback(() => {
        generation.current += 1
        clearPoll()
        releaseSession()
        if (!mounted.current) return
        setCandidates([])
        setRetryAfterSeconds(null)
        setState('idle')
    }, [clearPoll, releaseSession])

    const shake = useCallback(
        async (location?: ShakeLocation | null) => {
            const gen = ++generation.current
            clearPoll()
            releaseSession()
            setRetryAfterSeconds(null)
            setState('searching')

            const previous = creating.current
            const attempt = previous.then(async () => {
                if (!isCurrent(gen)) return
                try {
                    const session = await shakeApi.createSession(location)
                    if (!isCurrent(gen)) {
                        cancelQuietly(session.sessionId)
                        return
                    }
                    sessionId.current = session.sessionId
                    if (session.status !== 'active') {
                        sessionId.current = null
                        setCandidates([])
                        setState('expired')
                        return
                    }
                    setCandidates(session.candidates)
                    schedulePoll(gen, session.sessionId, 0)
                } catch (error) {
                    if (!isCurrent(gen)) return
                    setCandidates([])
                    if (apiErrorStatus(error) === 429) {
                        setRetryAfterSeconds(retryAfterOf(error))
                        setState('rate-limited')
                    } else {
                        setState('error')
                    }
                }
            })
            creating.current = attempt
            await attempt
        },
        [clearPoll, releaseSession, isCurrent, schedulePoll]
    )

    useEffect(() => {
        mounted.current = true
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') stop()
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            document.removeEventListener('visibilitychange', onVisibility)
            mounted.current = false
            generation.current += 1
            clearPoll()
            releaseSession()
        }
    }, [stop, clearPoll, releaseSession])

    return { state, candidates, retryAfterSeconds, shake, stop }
}
