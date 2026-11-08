'use client'
import { updateUserById, requestEmailChange } from '@/app/actions/users'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import isEmail from 'validator/lib/isEmail'
import ProfileEditField from './ProfileEditField'
import { invalidateCrispTokenId } from '@/hooks/useCrispTokenId'
import { resetCrispProxySessions } from '@/utils/crisp'

interface EmailFields {
    email: string
    code: string
}

export function EmailSettings({ onSaved }: { onSaved: () => void }) {
    const t = useTranslations('profile.edit')
    const tCommon = useTranslations('common')
    const { user, fetchUser } = useAuth()
    const [codeSentTo, setCodeSentTo] = useState('')
    const [isSendingCode, setIsSendingCode] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const {
        control,
        watch,
        handleSubmit,
        resetField,
        setError,
        formState: { dirtyFields, isSubmitting },
    } = useForm<EmailFields>({
        defaultValues: { email: user?.user.email ?? '', code: '' },
        mode: 'onChange',
    })
    const currentEmail = user?.user.email ?? ''
    const emailDirty = !!dirtyFields.email
    useEffect(() => {
        if (!emailDirty) resetField('email', { defaultValue: currentEmail })
    }, [currentEmail, emailDirty, resetField])

    const disabled = !user || isSubmitting || isSendingCode

    const emailValue = watch('email').trim()
    const needsEmailCode = !!currentEmail && emailDirty
    const hasCode = needsEmailCode && codeSentTo === emailValue

    const save = handleSubmit(async (values) => {
        if (!user || !emailDirty) return
        setErrorMessage('')
        try {
            if (needsEmailCode && !hasCode) {
                const result = await requestEmailChange(values.email.trim())
                if (result.error) {
                    if (result.error === 'This email is already associated with another account') {
                        setError('email', { type: 'server', message: t('errors.emailInUse') }, { shouldFocus: true })
                    } else setErrorMessage(result.error)
                } else {
                    resetField('code')
                    setCodeSentTo(values.email.trim())
                }
                return
            }
            // Send only changed fields. An email-only edit must neither require
            // a missing name nor overwrite a name changed by a KYC webhook.
            const result = await updateUserById({
                userId: user.user.userId,
                email: values.email.trim(),
                ...(hasCode ? { emailVerificationCode: values.code } : {}),
            })
            if (result?.error) {
                if (result.code === 'PROFILE_NAME_READ_ONLY') {
                    setErrorMessage(t('errors.nameReadOnly'))
                    return
                }
                if (result.error === 'This email is already associated with another account') {
                    setError('email', { type: 'server', message: t('errors.emailInUse') }, { shouldFocus: true })
                    return
                }
                setErrorMessage(result.error)
                return
            }
            if (hasCode) {
                // The API rotates the server-issued Crisp bearer in the same
                // transaction as a verified replacement. Invalidate it before
                // any best-effort device reset so support hooks fail closed even
                // when native Crisp cannot unbind its former session.
                invalidateCrispTokenId(user.user.userId)
                try {
                    await resetCrispProxySessions()
                } catch (error) {
                    // The email replacement is already committed. Keep showing
                    // the committed profile instead of turning a support-session
                    // cleanup failure into a false save failure.
                    Sentry.captureException(error)
                }
            }
            await fetchUser()
            onSaved()
        } catch (error) {
            setErrorMessage(tCommon('genericError'))
            Sentry.captureException(error)
        }
    })

    return (
        <form onSubmit={save} noValidate className="flex flex-col gap-4">
            <Controller
                name="email"
                control={control}
                rules={{
                    validate: (value) => !dirtyFields.email || isEmail(value.trim()) || t('errors.invalidEmail'),
                }}
                render={({ field, fieldState }) => (
                    <ProfileEditField
                        {...field}
                        label={t('fields.email')}
                        type="email"
                        autoComplete="email"
                        error={fieldState.error?.message}
                        disabled={disabled}
                    />
                )}
            />
            {hasCode && (
                <div className="flex flex-col gap-4">
                    <p className="text-body-s text-foreground-secondary">{t('emailCodeHelp', { email: codeSentTo })}</p>
                    <Controller
                        name="code"
                        control={control}
                        rules={{
                            validate: (value) => !hasCode || /^\d{6}$/.test(value) || t('errors.invalidCode'),
                        }}
                        render={({ field, fieldState }) => (
                            <ProfileEditField
                                {...field}
                                label={t('emailCode')}
                                autoComplete="one-time-code"
                                inputMode="numeric"
                                maxLength={6}
                                error={fieldState.error?.message}
                                disabled={disabled}
                            />
                        )}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={disabled}
                        onClick={async () => {
                            setIsSendingCode(true)
                            setErrorMessage('')
                            try {
                                const result = await requestEmailChange(emailValue)
                                if (result.error) setErrorMessage(result.error)
                                else resetField('code')
                            } catch {
                                setErrorMessage(tCommon('genericError'))
                            } finally {
                                setIsSendingCode(false)
                            }
                        }}
                    >
                        {t('requestNewCode')}
                    </Button>
                </div>
            )}
            <div className="flex flex-col gap-4">
                {errorMessage && <Callout priority="error">{errorMessage}</Callout>}
                <Button
                    type="submit"
                    disabled={disabled || !emailDirty}
                    className="w-full"
                    shadowSize="4"
                    loading={isSubmitting}
                >
                    {t(needsEmailCode && !hasCode ? 'sendCode' : 'saveChanges')}
                </Button>
            </div>
        </form>
    )
}
