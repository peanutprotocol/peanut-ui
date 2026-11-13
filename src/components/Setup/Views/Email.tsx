'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import ProfileEditField from '@/components/Profile/components/ProfileEditField'
import { useAuth } from '@/context/authContext'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { updateUserById } from '@/app/actions/users'
import { isValidEmail } from '@/utils/format.utils'
import { USER } from '@/constants/query.consts'
import type { IUserProfile } from '@/interfaces/interfaces'
import { SetupDocLink } from '../components/SetupDocsDrawer'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { addBreadcrumb, captureException } from '@/utils/sentry-lazy'
import { reportEmailSaveFailure } from '@/features/setup/report-email-save-failure'
import { useSignupControl } from '@/features/setup/useSignupControl'

export default function EmailStep() {
    const t = useTranslations('setup.email')
    const tNotifications = useTranslations('setup.notifications')
    const { user, fetchUser } = useAuth()
    const queryClient = useQueryClient()
    const { notificationEmail, setNotificationEmail, setIsLoading: setSetupLoading } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const [email, setEmail] = useState(notificationEmail || user?.user.email || '')
    const [error, setError] = useState<string>()
    const [emailInUse, setEmailInUse] = useState(false)
    const [saving, setSaving] = useState(false)
    const [keepCurrentEmail, setKeepCurrentEmail] = useState(false)
    const savingRef = useRef(false)
    const saveAttemptsRef = useRef(0)
    const { track, trackOnce } = useSignupControl()
    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        if (savingRef.current) return
        track('continue', 'tap')
        setError(undefined)
        setEmailInUse(false)
        const value = email.trim()
        if (!keepCurrentEmail && !isValidEmail(value)) {
            setError(t('invalid'))
            track('email', 'error', 'invalid')
            return
        }
        if (!user?.user.userId) {
            setError(t('notReady'))
            track('email', 'error', 'not_ready')
            return
        }
        savingRef.current = true
        setSaving(true)
        setSetupLoading(true)
        // A protected replacement keeps the confirmed address; drafts survive retryable errors.
        setNotificationEmail(keepCurrentEmail ? user.user.email || '' : value)
        try {
            // updateUserById returns every failure, including a network error
            // after its one retry, as `result.error`. The button stays enabled
            // after an error, so Continue retries the save; it never skips it.
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
                        track('email', 'error', protectedFailure)
                        return
                    }
                    setEmailInUse(duplicate)
                    setError(t(duplicate ? 'alreadyRegistered' : 'saveFailed'))
                    track('email', 'error', duplicate ? 'already_registered' : 'save_failed')
                    // Retryable failures keep the draft and require a confirmed save.
                    return
                }
                // Profile and KYC read this shared account cache. Reflect the
                // acknowledged write even if the background refresh fails.
                queryClient.setQueryData<IUserProfile | null>([USER], (profile) => {
                    if (profile?.user.userId !== user.user.userId) return profile
                    return { ...profile, user: { ...profile.user, email: value } }
                })
                void fetchUser().catch(() => {})
            }
            // A navigation failure is not a failed save: showing saveFailed
            // here would ask the user to retry an email the API already has.
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
    return (
        <form onSubmit={save} noValidate className="flex w-full flex-1 flex-col">
            <div className="flex flex-1 flex-col justify-center">
                <ProfileEditField
                    label={t('label')}
                    inputSize="md"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    value={email}
                    onChange={(value) => {
                        trackOnce('email', 'change')
                        setEmail(value)
                        setError(undefined)
                        setEmailInUse(false)
                        setKeepCurrentEmail(false)
                    }}
                    placeholder={t('placeholder')}
                    error={error}
                    disabled={saving}
                />
            </div>
            <SetupFooter
                actions={
                    <Button
                        type="submit"
                        shadowSize="4"
                        loading={saving}
                        disabled={saving || (!keepCurrentEmail && !email.trim())}
                    >
                        {t('continue')}
                    </Button>
                }
                secondary={
                    <p className="w-full border-t border-border-subtle pt-4 text-center text-body-xs text-foreground-secondary compact:pt-2">
                        {t('optOutNote')}
                    </p>
                }
            >
                {keepCurrentEmail && <p role="status">{tNotifications('changeAnytime')}</p>}
                {emailInUse && (
                    <SetupDocLink
                        kind="account-recovery"
                        href="/en/help/account-recovery"
                        className={LINK_BUTTON_CLASSES}
                    >
                        <Icon name="info" size={16} className="shrink-0" />
                        {t('recoveryGuide')}
                    </SetupDocLink>
                )}
            </SetupFooter>
        </form>
    )
}
