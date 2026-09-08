'use client'
import { updateUserById } from '@/app/actions/users'
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

interface ProfileFields {
    name: string
    surname: string
    email: string
}

export const ProfileEditView = () => {
    const t = useTranslations('profile.edit')
    const tMenu = useTranslations('profile.menu')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const onBack = useSafeBack('/profile')
    const { user, fetchUser } = useAuth()
    const { isVerified: isKycApproved, isLoading: isIdentityLoading } = useIdentityVerification()
    const canEditName = !isKycApproved
    const [errorMessage, setErrorMessage] = useState('')
    const [showFullName, setShowFullName] = useState(user?.user.showFullName ?? false)
    const {
        control,
        handleSubmit,
        reset,
        formState: { dirtyFields, isSubmitting },
    } = useForm<ProfileFields>({
        defaultValues: { name: '', surname: '', email: '' },
        mode: 'onChange',
    })
    const hydrated = useRef(false)
    useEffect(() => {
        setShowFullName(user?.user.showFullName ?? false)
        // Keep the fields and their baseline together. Background auth refreshes
        // must not overwrite edits or make untouched values dirty.
        if (!user || hydrated.current) return
        hydrated.current = true
        const parts = (user.user.fullName || '').trim().split(/\s+/)
        const surname = parts.length > 1 ? parts.pop()! : ''
        reset({ name: parts.join(' '), surname, email: user.user.email || '' })
    }, [user, reset])

    const nameChanged = canEditName && !!(dirtyFields.name || dirtyFields.surname)
    const isDirty = nameChanged || !!dirtyFields.email
    const disabled = !user || isIdentityLoading || isSubmitting

    const save = handleSubmit(async (values) => {
        if (!user || !isDirty || isIdentityLoading) return
        setErrorMessage('')
        try {
            // Send only changed fields. An email-only edit must neither require
            // a missing name nor overwrite a name changed by a KYC webhook.
            const result = await updateUserById({
                userId: user.user.userId,
                ...(nameChanged ? { fullName: `${values.name.trim()} ${values.surname.trim()}`.trim() } : {}),
                ...(dirtyFields.email ? { email: values.email.trim() } : {}),
            })
            if (result?.error) {
                setErrorMessage(result.error)
                return
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
                        {t('saveChanges')}
                    </Button>
                </div>
            </form>
            <DeleteAccountButton />
        </div>
    )
}
