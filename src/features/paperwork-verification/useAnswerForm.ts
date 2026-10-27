'use client'

import { useCallback, useRef, useState } from 'react'
import { saveKycAnswers } from '@/app/actions/kyc-paperwork-verification'
import { useOptionalAuth } from '@/context/authContext'
import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationFeature,
    PaperworkVerificationStep,
    PaperworkVerificationStepId,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { forgetSavedAnswers, keepAnswerDraft, readAnswerDraft, withAnswerDraft } from './answerDraft'
import { initialValues, stepPayload, withEmploymentStatus } from './paperworkVerification.utils'

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

/** Saves the steps in the server's order, stopping at the first one it refuses. */
export async function saveSteps(
    steps: PaperworkVerificationStep[],
    values: PaperworkVerificationAnswers,
    feature?: PaperworkVerificationFeature,
    userId?: string
): Promise<SaveOutcome> {
    let next: PaperworkVerificationStepId | null = null
    for (const step of steps) {
        const result = await saveKycAnswers(step.id, stepPayload(step.fields, values), feature)
        if (result.kind === 'invalid') return { ok: false, rejected: { step: step.id, errors: result.errors } }
        if (result.kind === 'conflict') {
            const error = CONFLICTS.has(result.code) ? (result.code as AnswerFormError) : 'conflict'
            return { ok: false, error, formError: error }
        }
        if (result.kind === 'blocked') return { ok: false, formError: result.code }
        if (result.kind === 'retry') return { ok: false, error: 'retry', formError: 'retry' }
        forgetSavedAnswers(userId, Object.fromEntries(step.fields.map((f) => [f.key, values[f.key]])))
        next = result.next
    }
    return { ok: true, next }
}

/**
 * The answers of the steps on screen, saved step by step in the server's
 * order. Until a step is saved its answers are also kept on the device
 * (answerDraft.ts), so a restart doesn't lose them. One save runs at a time,
 * so a double tap on Continue sends one request.
 */
export function useAnswerForm(
    steps: PaperworkVerificationStep[],
    feature?: PaperworkVerificationFeature,
    residence: string | null = null,
    /** what a background save of these steps came back with */
    returned?: { errors?: Record<string, string>; formError?: AnswerFormError }
) {
    const userId = useOptionalAuth()?.user?.user.userId
    const [values, setValues] = useState<PaperworkVerificationAnswers>(() => {
        const fields = steps.flatMap((s) => s.fields)
        return withAnswerDraft(initialValues(fields, residence), fields, readAnswerDraft(userId))
    })
    const [errors, setErrors] = useState<Record<string, string>>(() => returned?.errors ?? {})
    const [formError, setFormError] = useState<AnswerFormError | null>(() => returned?.formError ?? null)
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)

    const change = useCallback(
        (key: string, value: string) => {
            const fields = steps.flatMap((s) => s.fields)
            const update = (current: PaperworkVerificationAnswers) =>
                key === 'employmentStatus' ? withEmploymentStatus(fields, current, value) : { ...current, [key]: value }
            setValues(update)
            // A status that answers the job changes the job too, so the device keeps both.
            const job = key === 'employmentStatus' && fields.some((f) => f.key === 'occupation')
            keepAnswerDraft(
                userId,
                job ? { [key]: value, occupation: update(values).occupation ?? '' } : { [key]: value }
            )
            setErrors((current) => {
                if (!(key in current)) return current
                const { [key]: _cleared, ...rest } = current
                return rest
            })
            setFormError(null)
        },
        [steps, userId, values]
    )

    const save = useCallback(
        async (toSave: PaperworkVerificationStep[] = steps): Promise<SaveOutcome> => {
            if (savingRef.current) return { ok: false }
            savingRef.current = true
            setSaving(true)
            setFormError(null)
            try {
                const outcome = await saveSteps(toSave, values, feature, userId)
                if (outcome.ok) setErrors({})
                if (!outcome.ok && outcome.rejected) setErrors(outcome.rejected.errors)
                if (!outcome.ok && outcome.formError) setFormError(outcome.formError)
                return outcome
            } finally {
                savingRef.current = false
                setSaving(false)
            }
        },
        [steps, values, feature, userId]
    )

    return { values, errors, formError, saving, change, save, setFormError }
}
