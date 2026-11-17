'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateUserById } from '@/app/actions/users'
import { USER } from '@/constants/query.consts'
import { useAuth } from '@/context/authContext'
import { reportEmailSaveFailure } from '@/features/setup/report-email-save-failure'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import type { IUserProfile } from '@/interfaces/interfaces'
import { isValidEmail } from '@/utils/format.utils'
import { suggestEmailFix } from './email-typo'
import { addBreadcrumb, captureException } from '@/utils/sentry-lazy'

/** What the field shows besides the value: a wrong address, a used one, a failed save, an account still loading. */
export type EmailMode = 'edit' | 'invalid' | 'taken' | 'failed' | 'not-ready'

export type EmailState =
    | 'default'
    | 'filled'
    | 'invalid'
    | 'already-registered'
    | 'save-failed'
    | 'saving'
    | 'not-ready'
    | 'kept-current'

/**
 * The 09 Email step's logic, moved from dev's `Views/Email.tsx`. Redesign differences (contract P4 § 2): Continue
 * waits for a valid address, `invalid` shows on blur, and "Use another email" leaves `already-registered`.
 */
export function useEmailStep() {
    const { user, fetchUser } = useAuth()
    const queryClient = useQueryClient()
    const { notificationEmail, setNotificationEmail, setIsLoading: setSetupLoading } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const [email, setEmail] = useState(notificationEmail || user?.user.email || '')
    const [mode, setMode] = useState<EmailMode>('edit')
    const [saving, setSaving] = useState(false)
    const [keepCurrentEmail, setKeepCurrentEmail] = useState(false)
    const savingRef = useRef(false)
    const saveAttemptsRef = useRef(0)
    const { track, trackOnce, trackError } = useSignupControl()

    const valid = isValidEmail(email.trim())
    const canContinue = keepCurrentEmail || (valid && mode !== 'invalid' && mode !== 'taken')
    // A hint, not a gate: Continue keeps the address as typed.
    const suggestion = valid && mode === 'edit' && !keepCurrentEmail && !saving ? suggestEmailFix(email) : null

    const state: EmailState = saving
        ? 'saving'
        : keepCurrentEmail
          ? 'kept-current'
          : mode === 'taken'
            ? 'already-registered'
            : mode === 'failed'
              ? 'save-failed'
              : mode === 'invalid'
                ? 'invalid'
                : mode === 'not-ready'
                  ? 'not-ready'
                  : valid
                    ? 'filled'
                    : 'default'

    const change = (value: string) => {
        trackOnce('email', 'change')
        trackError('email', null)
        setEmail(value)
        setMode('edit')
        setKeepCurrentEmail(false)
    }

    const blur = () => {
        const value = email.trim()
        if (mode !== 'edit' || keepCurrentEmail || !value || isValidEmail(value)) return
        setMode('invalid')
        trackError('email', 'invalid')
    }

    const acceptSuggestion = () => {
        if (!suggestion) return
        track('email_suggestion', 'tap')
        change(suggestion)
    }

    const chooseAnother = () => {
        track('use_another_email', 'tap')
        trackError('email', null)
        setEmail('')
        setMode('edit')
    }

    const save = async () => {
        if (savingRef.current) return
        const value = email.trim()
        if (!keepCurrentEmail && !isValidEmail(value)) {
            // Enter on a wrong address: the same line as a blur
            if (value) {
                setMode('invalid')
                trackError('email', 'invalid')
            }
            return
        }
        track('continue', 'tap')
        trackError('email', null)
        setMode('edit')
        if (!user?.user.userId) {
            setMode('not-ready')
            trackError('email', 'not_ready')
            return
        }
        savingRef.current = true
        setSaving(true)
        setSetupLoading(true)
        // A protected replacement keeps the confirmed address; drafts survive retryable errors.
        setNotificationEmail(keepCurrentEmail ? user.user.email || '' : value)
        try {
            // updateUserById returns every failure, including a network error after its one retry, as
            // `result.error`. Continue stays enabled after an error, so it retries the save; it never skips it.
            if (!keepCurrentEmail && user.user.email?.trim().toLowerCase() !== value.toLowerCase()) {
                saveAttemptsRef.current += 1
                const result = await updateUserById({ userId: user.user.userId, email: value }).catch(() => ({
                    error: 'request failed',
                    failureKind: 'other' as const,
                    status: undefined,
                }))
                if (result.error) {
                    const code = 'code' in result ? result.code : undefined
                    const duplicate =
                        code === 'EMAIL_IN_USE' ||
                        result.error === 'This email is already associated with another account'
                    const protectedFailure =
                        code === 'STEP_UP_REQUIRED' && result.status === 401
                            ? 'step_up_required'
                            : code === 'EMAIL_VERIFICATION_REQUIRED' ||
                                (result.status === 400 && /(?:email.*(?:verif|code)|verif.*email)/i.test(result.error))
                              ? 'email_verification_required'
                              : code === 'EMAIL_CHANGE_UNAVAILABLE' ||
                                  (result.status === 503 &&
                                      /email.*(?:change|replacement).*(?:unavailable|disabled)/i.test(result.error))
                                ? 'email_replacement_disabled'
                                : undefined
                    if (duplicate) {
                        // A user outcome, not a fault: on the trail, not an error event.
                        addBreadcrumb({
                            category: 'signup',
                            level: 'info',
                            message: 'Sign-up email already registered',
                        })
                    } else {
                        reportEmailSaveFailure({
                            failureKind: protectedFailure ?? result.failureKind,
                            status: result.status,
                            attempt: saveAttemptsRef.current,
                        })
                    }
                    if (protectedFailure && user.user.email?.trim()) {
                        setKeepCurrentEmail(true)
                        setEmail(user.user.email || '')
                        setNotificationEmail(user.user.email || '')
                        trackError('email', protectedFailure)
                        return
                    }
                    setMode(duplicate ? 'taken' : 'failed')
                    trackError('email', duplicate ? 'already_registered' : 'save_failed')
                    return
                }
                // Profile and KYC read this shared account cache. Reflect the acknowledged write even if the
                // background refresh fails.
                queryClient.setQueryData<IUserProfile | null>([USER], (profile) => {
                    if (profile?.user.userId !== user.user.userId) return profile
                    return { ...profile, user: { ...profile.user, email: value } }
                })
                void fetchUser().catch(() => {})
            }
            // A navigation failure is not a failed save: the API already has the email.
            try {
                await handleNext()
            } catch (navigationError) {
                captureException(navigationError)
            }
        } finally {
            savingRef.current = false
            setSaving(false)
            setSetupLoading(false)
        }
    }

    return {
        email,
        mode,
        state,
        valid,
        saving,
        keepCurrentEmail,
        canContinue,
        suggestion,
        change,
        blur,
        acceptSuggestion,
        chooseAnother,
        save,
    }
}
