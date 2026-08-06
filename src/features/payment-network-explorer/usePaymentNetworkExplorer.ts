'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    createExplorerFocus,
    createExplorerSession,
    fetchPaymentNetwork,
    PaymentNetworkApiError,
    revealExplorerNode,
} from './api'
import type {
    ExplorerRequest,
    ExplorerSession,
    FocusResponse,
    PaymentNetworkResponse,
    RevealReason,
    RevealResponse,
} from './types'

const RENEW_EARLY_MS = 60_000

export type ExplorerLoadStatus = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error'

export interface PaymentNetworkExplorerState {
    data: PaymentNetworkResponse | null
    session: ExplorerSession | null
    status: ExplorerLoadStatus
    error: PaymentNetworkApiError | null
    searching: boolean
    revealing: boolean
    reload: () => void
    focusUsername: (username: string) => Promise<FocusResponse>
    revealNode: (token: string, reason: RevealReason) => Promise<RevealResponse>
}

function sessionIsFresh(session: ExplorerSession | null): boolean {
    return !!session && new Date(session.expiresAt).getTime() - Date.now() > RENEW_EARLY_MS
}

export function usePaymentNetworkExplorer(request: ExplorerRequest | null): PaymentNetworkExplorerState {
    const [data, setData] = useState<PaymentNetworkResponse | null>(null)
    const [session, setSession] = useState<ExplorerSession | null>(null)
    const [status, setStatus] = useState<ExplorerLoadStatus>('idle')
    const [error, setError] = useState<PaymentNetworkApiError | null>(null)
    const [searching, setSearching] = useState(false)
    const [revealing, setRevealing] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)
    const sessionRef = useRef<ExplorerSession | null>(null)
    const sessionRequestRef = useRef<Promise<ExplorerSession> | null>(null)

    const setCurrentSession = useCallback((next: ExplorerSession | null) => {
        sessionRef.current = next
        setSession(next)
    }, [])

    const ensureSession = useCallback(
        async (signal?: AbortSignal, force = false): Promise<ExplorerSession> => {
            if (!force && sessionIsFresh(sessionRef.current)) return sessionRef.current!
            if (!force && sessionRequestRef.current) return sessionRequestRef.current
            const pending = createExplorerSession(signal)
            sessionRequestRef.current = pending
            try {
                const next = await pending
                setCurrentSession(next)
                return next
            } finally {
                if (sessionRequestRef.current === pending) sessionRequestRef.current = null
            }
        },
        [setCurrentSession]
    )

    const requestKey = useMemo(() => (request ? JSON.stringify(request) : ''), [request])

    useEffect(() => {
        if (!request) {
            setData(null)
            setStatus('idle')
            return
        }
        const controller = new AbortController()
        let active = true

        const load = async () => {
            setData(null)
            setError(null)
            setStatus('loading')
            try {
                await ensureSession(controller.signal)
                let next: PaymentNetworkResponse
                try {
                    next = await fetchPaymentNetwork(request, controller.signal)
                } catch (loadError) {
                    if (!(loadError instanceof PaymentNetworkApiError) || loadError.status !== 401) throw loadError
                    await ensureSession(controller.signal, true)
                    next = await fetchPaymentNetwork(request, controller.signal)
                }
                if (!active) return
                setData(next)
                setStatus('ready')
            } catch (loadError) {
                if (!active || controller.signal.aborted) return
                const apiError =
                    loadError instanceof PaymentNetworkApiError
                        ? loadError
                        : new PaymentNetworkApiError('The live payment network is unavailable. Try again.', 503)
                if (apiError.status === 401 || apiError.status === 403) {
                    setCurrentSession(null)
                    setData(null)
                }
                setError(apiError)
                setStatus(apiError.status === 403 ? 'forbidden' : 'error')
            }
        }

        void load()
        return () => {
            active = false
            controller.abort()
        }
        // requestKey is the stable serialization of the immutable request.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestKey, reloadKey, ensureSession, setCurrentSession])

    useEffect(() => {
        if (!session) return
        const renewIn = Math.max(0, new Date(session.expiresAt).getTime() - Date.now() - RENEW_EARLY_MS)
        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            void ensureSession(controller.signal, true).catch((renewError) => {
                if (controller.signal.aborted) return
                if (
                    renewError instanceof PaymentNetworkApiError &&
                    (renewError.status === 401 || renewError.status === 403)
                ) {
                    setCurrentSession(null)
                    setData(null)
                    setError(renewError)
                    setStatus(renewError.status === 403 ? 'forbidden' : 'error')
                }
            })
        }, renewIn)
        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [ensureSession, session, setCurrentSession])

    const focusUsername = useCallback(
        async (username: string) => {
            setSearching(true)
            try {
                await ensureSession()
                return await createExplorerFocus(username)
            } finally {
                setSearching(false)
            }
        },
        [ensureSession]
    )

    const revealNode = useCallback(
        async (token: string, reason: RevealReason) => {
            setRevealing(true)
            try {
                await ensureSession()
                return await revealExplorerNode(token, reason)
            } finally {
                setRevealing(false)
            }
        },
        [ensureSession]
    )

    return {
        data,
        session,
        status,
        error,
        searching,
        revealing,
        reload: () => setReloadKey((value) => value + 1),
        focusUsername,
        revealNode,
    }
}
