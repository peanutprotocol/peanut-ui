'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startPaperworkVerificationIdentity } from '@/app/actions/kyc-paperwork-verification'
import type {
    PaperworkVerificationDocument,
    PaperworkVerificationStepId,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import type { KycAttemptSession } from '@/app/actions/types/kyc-workflow.types'
import { useOptionalAuth } from '@/context/authContext'
import { forgetAnswerDraft } from './answerDraft'

type Session = {
    attemptId: string
    document?: PaperworkVerificationDocument
    token: string
    sdkConfig: KycAttemptSession['sdkConfig'] | undefined
}
export type IdentityStartOutcome =
    | { kind: 'busy' }
    | { kind: 'opened'; attemptId: string }
    | { kind: 'document-required'; message?: string }
    | { kind: 'document-not-allowed'; message?: string }
    | { kind: 'questions-missing'; step: PaperworkVerificationStepId | null; message?: string }
    | { kind: 'complete'; message?: string }
    | { kind: 'failed'; message?: string }

/** The server's preselected ID, so Sumsub never shows its own document list; a reopen without a pick gets the saved one. */
const preselected = (sdkConfig: KycAttemptSession['sdkConfig'] | undefined) =>
    sdkConfig?.documentDefinitions?.IDENTITY ? sdkConfig : undefined

/**
 * The ID + selfie session of the Smart Paperwork Verification attempt. The document picked at
 * the midpoint only preselects it in Sumsub; a token refresh mints again with
 * the same pick.
 */
export function usePaperworkVerificationIdentity() {
    const userId = useOptionalAuth()?.user?.user.userId
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
        async (attemptId: string, document?: PaperworkVerificationDocument): Promise<IdentityStartOutcome> => {
            if (busyRef.current) return { kind: 'busy' }
            const active = generation.current
            setDocumentRequired(false)
            busyRef.current = true
            setBusy(true)
            try {
                const result = await startPaperworkVerificationIdentity(attemptId, document)
                if (active !== generation.current) return { kind: 'failed' }
                if (result.kind !== 'session') return result
                // The ID check opens only once every answer is saved.
                forgetAnswerDraft(userId)
                const next = {
                    attemptId: result.session.attemptId,
                    document,
                    token: result.session.token,
                    sdkConfig: preselected(result.session.sdkConfig),
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
        [userId]
    )

    const refreshToken = useCallback(async () => {
        const current = sessionRef.current
        if (!current) throw new Error('No verification session')
        const result = await startPaperworkVerificationIdentity(current.attemptId, current.document)
        if (sessionRef.current !== current) throw new Error('Verification session closed')
        if (result.kind === 'document-required' || result.kind === 'document-not-allowed') {
            sessionRef.current = null
            setSession(null)
            setDocumentRequired(true)
        }
        if (result.kind !== 'session') throw new Error('Failed to refresh verification token')
        sessionRef.current = {
            ...current,
            attemptId: result.session.attemptId,
            token: result.session.token,
            sdkConfig: preselected(result.session.sdkConfig) ?? current.sdkConfig,
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
