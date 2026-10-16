'use client'

import { useCallback, useRef, useState } from 'react'
import { saveKycAnswers } from '@/app/actions/kyc-verify-once'
import type {
    VerifyOnceAnswers,
    VerifyOnceFeature,
    VerifyOnceStep,
    VerifyOnceStepId,
} from '@/app/actions/types/kyc-verify-once.types'
import { initialValues, stepPayload } from './verifyOnce.utils'

export type AnswerFormError =
    | 'retry'
    | 'feature_not_selected'
    | 'identity_submitted'
    | 'unavailable'
    | 'existing_verification'
    | 'conflict'
export type SaveOutcome = { ok: true; next: VerifyOnceStepId | null } | { ok: false; error?: AnswerFormError }

const CONFLICTS = new Set(['feature_not_selected', 'identity_submitted', 'unavailable', 'existing_verification'])

/**
 * The answers of the steps on screen: kept in memory only (never storage),
 * saved step by step in the server's order. One save runs at a time, so a
 * double tap on Continue sends one request.
 */
export function useAnswerForm(steps: VerifyOnceStep[], feature?: VerifyOnceFeature, residence: string | null = null) {
    const [values, setValues] = useState<VerifyOnceAnswers>(() =>
        initialValues(
            steps.flatMap((s) => s.fields),
            residence
        )
    )
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [formError, setFormError] = useState<AnswerFormError | null>(null)
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)

    const change = useCallback((key: string, value: string) => {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => {
            if (!(key in current)) return current
            const { [key]: _cleared, ...rest } = current
            return rest
        })
        setFormError(null)
    }, [])

    const save = useCallback(
        async (toSave: VerifyOnceStep[] = steps): Promise<SaveOutcome> => {
            if (savingRef.current) return { ok: false }
            savingRef.current = true
            setSaving(true)
            setFormError(null)
            let next: VerifyOnceStepId | null = null
            try {
                for (const step of toSave) {
                    const result = await saveKycAnswers(step.id, stepPayload(step.fields, values), feature)
                    if (result.kind === 'invalid') {
                        setErrors(result.errors)
                        return { ok: false }
                    }
                    if (result.kind === 'conflict') {
                        const error = CONFLICTS.has(result.code) ? (result.code as AnswerFormError) : 'conflict'
                        setFormError(error)
                        return { ok: false, error }
                    }
                    if (result.kind === 'retry') {
                        setFormError('retry')
                        return { ok: false, error: 'retry' }
                    }
                    next = result.next
                }
                setErrors({})
                return { ok: true, next }
            } finally {
                savingRef.current = false
                setSaving(false)
            }
        },
        [steps, values, feature]
    )

    return { values, errors, formError, saving, change, save, setFormError }
}
