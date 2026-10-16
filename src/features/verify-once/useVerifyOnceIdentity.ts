'use client'

import { useCallback, useRef, useState } from 'react'
import { startVerifyOnceIdentity } from '@/app/actions/kyc-verify-once'
import type { VerifyOnceDocument, VerifyOnceStepId } from '@/app/actions/types/kyc-verify-once.types'
import type { KycAttemptSession } from '@/app/actions/types/kyc-workflow.types'

type Session = {
    attemptId: string
    document: VerifyOnceDocument
    token: string
    sdkConfig: KycAttemptSession['sdkConfig']
}
export type IdentityStartOutcome =
    | { kind: 'opened' }
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
    const busyRef = useRef(false)
    const sessionRef = useRef<Session | null>(null)

    const open = useCallback(async (attemptId: string, document: VerifyOnceDocument): Promise<IdentityStartOutcome> => {
        if (busyRef.current) return { kind: 'failed' }
        busyRef.current = true
        setBusy(true)
        try {
            const result = await startVerifyOnceIdentity(attemptId, document)
            if (result.kind === 'questions-missing') return result
            if (result.kind === 'failed') return result
            const next = { attemptId, document, token: result.session.token, sdkConfig: result.session.sdkConfig }
            sessionRef.current = next
            setSession(next)
            return { kind: 'opened' }
        } finally {
            busyRef.current = false
            setBusy(false)
        }
    }, [])

    const refreshToken = useCallback(async () => {
        const current = sessionRef.current
        if (!current) throw new Error('No verification session')
        const result = await startVerifyOnceIdentity(current.attemptId, current.document)
        if (result.kind !== 'session') throw new Error('Failed to refresh verification token')
        sessionRef.current = { ...current, token: result.session.token }
        setSession(sessionRef.current)
        return result.session.token
    }, [])

    const close = useCallback(() => {
        sessionRef.current = null
        setSession(null)
    }, [])

    return { session, busy, open, refreshToken, close }
}
