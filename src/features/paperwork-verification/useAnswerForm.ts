'use client'

import { useCallback, useRef, useState } from 'react'
import { saveKycAnswers } from '@/app/actions/kyc-paperwork-verification'
import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationFeature,
    PaperworkVerificationStep,
    PaperworkVerificationStepId,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { initialValues, stepPayload } from './paperworkVerification.utils'

export type AnswerFormError =
    | 'retry'
    | 'invalid_body'
    | 'unknown_step'
    | 'rate_limited'
    | 'feature_not_selected'
    | 'identity_submitted'
    | 'unavailable'
    | 'existing_verification'
    | 'conflict'
export type SaveOutcome =
    | { ok: true; next: PaperworkVerificationStepId | null }
    | {
          ok: false
          error?: AnswerFormError
          /** the form-level message shown, if any */
          formError?: AnswerFormError
          /** the step the server refused, with its field error codes */
          rejected?: { step: PaperworkVerificationStepId; errors: Record<string, string> }
      }

const CONFLICTS = new Set(['feature_not_selected', 'identity_submitted', 'unavailable', 'existing_verification'])

/**
 * The answers of the steps on screen: kept in memory only (never storage),
 * saved step by step in the server's order. One save runs at a time, so a
 * double tap on Continue sends one request.
 */
export function useAnswerForm(
    steps: PaperworkVerificationStep[],
    feature?: PaperworkVerificationFeature,
    residence: string | null = null
) {
    const [values, setValues] = useState<PaperworkVerificationAnswers>(() =>
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
        async (toSave: PaperworkVerificationStep[] = steps): Promise<SaveOutcome> => {
            if (savingRef.current) return { ok: false }
            savingRef.current = true
            setSaving(true)
            setFormError(null)
            let next: PaperworkVerificationStepId | null = null
            try {
                for (const step of toSave) {
                    const result = await saveKycAnswers(step.id, stepPayload(step.fields, values), feature)
                    if (result.kind === 'invalid') {
                        setErrors(result.errors)
                        return { ok: false, rejected: { step: step.id, errors: result.errors } }
                    }
                    if (result.kind === 'conflict') {
                        const error = CONFLICTS.has(result.code) ? (result.code as AnswerFormError) : 'conflict'
                        setFormError(error)
                        return { ok: false, error, formError: error }
                    }
                    if (result.kind === 'blocked') {
                        setFormError(result.code)
                        return { ok: false, formError: result.code }
                    }
                    if (result.kind === 'retry') {
                        setFormError('retry')
                        return { ok: false, error: 'retry', formError: 'retry' }
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
