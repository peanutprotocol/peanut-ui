'use client'
import { updateUserById, requestEmailChange } from '@/app/actions/users'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import isEmail from 'validator/lib/isEmail'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon } from '@/components/Global/Icons/Icon'
import DeleteAccountButton from '@/components/Settings/DeleteAccountButton'
import ShowNameToggle from '../components/ShowNameToggle'
import ProfileEditField from '../components/ProfileEditField'
import ProfileHeader from '../components/ProfileHeader'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useSafeBack } from '@/hooks/useSafeBack'
import { invalidateCrispTokenId } from '@/hooks/useCrispTokenId'
import { resetCrispProxySessions } from '@/utils/crisp'

interface ProfileFields {
    name: string
    surname: string
    email: string
    code: string
}

export const ProfileEditView = () => {
    const t = useTranslations('profile.edit')
    const tMenu = useTranslations('profile.menu')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const onBack = useSafeBack('/profile')
    const { user, fetchUser } = useAuth()
    const { isVerified: isKycApproved, isLoading: isIdentityLoading } = useIdentityVerification()
    const nameLocked = user?.profileNameLocked ?? isKycApproved
    const canEditName = !nameLocked
    const [codeSentTo, setCodeSentTo] = useState('')
    const [isSendingCode, setIsSendingCode] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [showFullName, setShowFullName] = useState(user?.user.showFullName ?? false)
    const {
        control,
        watch,
        handleSubmit,
        reset,
        resetField,
        setError,
        formState: { dirtyFields, isSubmitting },
    } = useForm<ProfileFields>({
        defaultValues: { name: '', surname: '', email: '', code: '' },
        mode: 'onChange',
    })
    const hydrated = useRef(false)
    useEffect(() => {
        setShowFullName(user?.user.showFullName ?? false)
        // Keep the fields and their baseline together. Background auth refreshes
        // must not overwrite edits or make untouched values dirty.
        if (!user || (hydrated.current && !nameLocked)) return
        const parts = (user.user.fullName || '').trim().split(/\s+/)
        const surname = parts.length > 1 ? parts.pop()! : ''
        if (hydrated.current) {
            // Once verified, show the provider-owned name even if verification
            // finished during an edit. Keep the user's email draft untouched.
            resetField('name', { defaultValue: parts.join(' ') })
            resetField('surname', { defaultValue: surname })
            return
        }
        hydrated.current = true
        reset({ name: parts.join(' '), surname, email: user.user.email || '', code: '' })
    }, [user, nameLocked, reset, resetField])

    const nameChanged = canEditName && !!(dirtyFields.name || dirtyFields.surname)
    const isDirty = nameChanged || !!dirtyFields.email
    const disabled = !user || isIdentityLoading || isSubmitting || isSendingCode

    const emailValue = watch('email').trim()
    const needsEmailCode = !!user?.user.email && !!dirtyFields.email
    const hasCode = needsEmailCode && codeSentTo === emailValue

    const save = handleSubmit(async (values) => {
        if (!user || !isDirty || isIdentityLoading) return
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
                ...(nameChanged ? { fullName: `${values.name.trim()} ${values.surname.trim()}`.trim() } : {}),
                ...(dirtyFields.email ? { email: values.email.trim() } : {}),
                ...(hasCode ? { emailVerificationCode: values.code } : {}),
            })
            if (result?.error) {
                if (result.error === 'This email is already associated with another account') {
                    setError('email', { type: 'server', message: t('errors.emailInUse') }, { shouldFocus: true })
                    return
                }
                setErrorMessage(result.error)
                return
            }
            if (hasCode) {
                // The API rotates the server-issued Crisp bearer in the same
                // transaction as a verified replacement. Unbind this device
                // from the former support session before refetching the profile,
                // then force every mounted support hook to fetch the new bearer.
                await resetCrispProxySessions()
                invalidateCrispTokenId(user.user.userId)
            }
            await fetchUser()
            router.replace('/profile')
        } catch (error) {
            setErrorMessage(tCommon('genericError'))
            Sentry.captureException(error)
        }
    })

    const username = user?.user.username || ''
    const displayName = showFullName && user?.user.fullName ? user.user.fullName : username

    return (
        <div className="flex flex-col gap-6">
            <NavHeader title={t('title')} onPrev={onBack} />
            <ProfileHeader name={displayName} username={username} isVerified={isKycApproved} showShareButton={false} />
            <form onSubmit={save} noValidate className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    <Controller
                        name="name"
                        control={control}
                        rules={{ validate: (value) => !nameChanged || !!value.trim() || t('errors.nameRequired') }}
                        render={({ field, fieldState }) => (
                            <ProfileEditField
                                {...field}
                                label={t('fields.name')}
                                error={fieldState.error?.message}
                                disabled={disabled || !canEditName}
                                autoComplete="given-name"
                            />
                        )}
                    />
                    <Controller
                        name="surname"
                        control={control}
                        render={({ field }) => (
                            <ProfileEditField
                                {...field}
                                label={t('fields.surname')}
                                disabled={disabled || !canEditName}
                                autoComplete="family-name"
                            />
                        )}
                    />
                    {!canEditName && <p className="text-body-s text-foreground-secondary">{t('verifiedNameHelp')}</p>}
                </div>
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
                        <p className="text-body-s text-foreground-secondary">
                            {t('emailCodeHelp', { email: codeSentTo })}
                        </p>
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
                            variant="transparent"
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
                {!!user?.user.fullName?.trim() && (
                    <ListItem
                        position="single"
                        leading={<Icon name="eye" size={24} />}
                        title={tMenu('showMyFullName')}
                        trailing={<ShowNameToggle checked={showFullName} onChange={setShowFullName} />}
                    />
                )}
                <div className="flex flex-col gap-4">
                    {errorMessage && <Notification priority="error">{errorMessage}</Notification>}
                    <Button
                        type="submit"
                        disabled={disabled || !isDirty}
                        className="w-full"
                        shadowSize="4"
                        loading={isSubmitting}
                    >
                        {t(needsEmailCode && !hasCode ? 'sendCode' : 'saveChanges')}
                    </Button>
                </div>
            </form>
            <DeleteAccountButton />
        </div>
    )
}
