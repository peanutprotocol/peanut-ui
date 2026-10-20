'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startVerifyOnceIdentity } from '@/app/actions/kyc-verify-once'
import type { VerifyOnceDocument, VerifyOnceStepId } from '@/app/actions/types/kyc-verify-once.types'
import type { KycAttemptSession } from '@/app/actions/types/kyc-workflow.types'

type Session = {
    attemptId: string
    document?: VerifyOnceDocument
    token: string
    sdkConfig: KycAttemptSession['sdkConfig'] | undefined
}
export type IdentityStartOutcome =
    | { kind: 'busy' }
    | { kind: 'opened'; attemptId: string }
    | { kind: 'document-required' }
    | { kind: 'questions-missing'; step: VerifyOnceStepId | null }
    | { kind: 'failed' }

/**
 * The ID + selfie session of the verify-once attempt. The document picked at
 * the midpoint only preselects it in Sumsub; a token refresh mints again with
 * the same pick.
 */
export function useVerifyOnceIdentity() {
    const [session, setSession] = useState<Session | null>(null)
    const [busy, setBusy] = useState(false)
    const [documentRequired, setDocumentRequired] = useState(false)
    const busyRef = useRef(false)
    const sessionRef = useRef<Session | null>(null)
    const attemptIdRef = useRef<string | null>(null)
    const generation = useRef(0)
    useEffect(
        () => () => {
            generation.current += 1
        },
        []
    )

    const open = useCallback(
        async (attemptId: string, document?: VerifyOnceDocument): Promise<IdentityStartOutcome> => {
            if (busyRef.current) return { kind: 'busy' }
            const active = generation.current
            setDocumentRequired(false)
            busyRef.current = true
            setBusy(true)
            try {
                const result = await startVerifyOnceIdentity(attemptId, document)
                if (active !== generation.current) return { kind: 'failed' }
                if (result.kind !== 'session') return result
                const next = {
                    attemptId: result.session.attemptId,
                    document,
                    token: result.session.token,
                    sdkConfig: document ? result.session.sdkConfig : undefined,
                }
                sessionRef.current = next
                attemptIdRef.current = next.attemptId
                setSession(next)
                return { kind: 'opened', attemptId: next.attemptId }
            } finally {
                busyRef.current = false
                setBusy(false)
            }
        },
        []
    )

    const refreshToken = useCallback(async () => {
        const current = sessionRef.current
        if (!current) throw new Error('No verification session')
        const result = await startVerifyOnceIdentity(current.attemptId, current.document)
        if (sessionRef.current !== current) throw new Error('Verification session closed')
        if (result.kind === 'document-required') {
            sessionRef.current = null
            setSession(null)
            setDocumentRequired(true)
        }
        if (result.kind !== 'session') throw new Error('Failed to refresh verification token')
        sessionRef.current = {
            ...current,
            attemptId: result.session.attemptId,
            token: result.session.token,
            sdkConfig: current.document ? result.session.sdkConfig : undefined,
        }
        attemptIdRef.current = result.session.attemptId
        setSession(sessionRef.current)
        return result.session.token
    }, [])

    const close = useCallback(() => {
        generation.current += 1
        sessionRef.current = null
        setSession(null)
    }, [])

    return { session, busy, open, refreshToken, close, documentRequired, attemptIdRef }
}
