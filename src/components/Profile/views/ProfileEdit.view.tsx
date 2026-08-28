'use client'
import { updateUserById } from '@/app/actions/users'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon } from '@/components/Global/Icons/Icon'
import DeleteAccountButton from '@/components/Settings/DeleteAccountButton'
import ShowNameToggle from '../components/ShowNameToggle'
import ProfileEditField from '../components/ProfileEditField'
import ProfileHeader from '../components/ProfileHeader'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useSafeBack } from '@/hooks/useSafeBack'

export const ProfileEditView = () => {
    const t = useTranslations('profile.edit')
    const tMenu = useTranslations('profile.menu')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const onBack = useSafeBack('/profile')
    const { user, fetchUser } = useAuth()
    // Verified badge + name/surname lock reflect *identity* verification (the human is ID-verified),
    // not rail approval. Switched from `useCapabilities().isKycApproved` (any enabled rail, including
    // Rain) to the provider-blind identityVerification projection — a rail-only approval must NOT
    // lock the legal-name fields because the rail's KYC was external to our identity flow.
    const { isVerified: isKycApproved } = useIdentityVerification()

    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    // split the full name into name and surname
    const splitName = useCallback((fullName: string) => {
        const parts = fullName.trim().split(' ')
        if (parts.length === 1) return { name: parts[0], surname: '' }
        const surname = parts.pop() || ''
        const name = parts.join(' ')
        return { name, surname }
    }, [])

    // form state for all fields
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        bio: '',
        email: user?.user.email || '',
        phone: '',
        website: '',
    })

    // check if email is already set
    const isEmailSet = !!user?.user.email

    // once identity-verified the name is provider-owned, so the name/surname
    // fields are locked and never sent. one source of truth for that invariant.
    const canEditName = !isKycApproved

    // the saved values, and the only fields the user can actually change
    const initial = useMemo(() => {
        const { name, surname } = splitName(user?.user.fullName || '')
        return { name, surname, email: user?.user.email || '' }
    }, [user?.user.fullName, user?.user.email, splitName])

    // What was in the fields when the form loaded. The dirty check compares
    // against THIS, not against `initial`: `initial` re-derives on every auth
    // refresh, so if the saved name changed elsewhere while this screen was
    // open, an untouched form went dirty and Save wrote the stale values back
    // over the newer ones. The baseline and the fields have to move together.
    const [baseline, setBaseline] = useState(() => ({ name: '', surname: '', email: user?.user.email || '' }))

    // Hydrate once, when the saved values first arrive. Re-applying `initial`
    // on a later refresh would wipe whatever the user had already typed, since
    // this screen is reachable before auth resolves.
    const hydrated = useRef(false)
    useEffect(() => {
        if (hydrated.current || !user) return
        hydrated.current = true
        setFormData((prev) => ({ ...prev, ...initial }))
        setBaseline(initial)
    }, [user, initial])

    // Save stays disabled until something the user may edit actually changed.
    // bio / phone / website are "Soon!" placeholders — always disabled, never
    // sent, so they can never make the form dirty.
    const isDirty =
        (canEditName && (formData.name !== baseline.name || formData.surname !== baseline.surname)) ||
        (!isEmailSet && formData.email !== baseline.email)

    // handle input field changes
    const handleChange = useCallback((field: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }))
    }, [])

    // handle form submission
    const handleSave = useCallback(async () => {
        try {
            setIsLoading(true)
            setErrorMessage('')

            // only require the name when the field is editable — requiring it
            // while it's locked (verified user, provider owns the name) would
            // trap users whose fullName is empty at load (can't type, can't
            // save) when all they want is to set their email.
            if (canEditName && !formData.name?.trim()) {
                setErrorMessage(t('errors.nameRequired'))
                return
            }

            // prepare request payload
            const payload: { userId?: string; fullName?: string; email?: string } = {
                userId: user?.user.userId,
            }

            // only include name when the field is editable (not provider-locked)
            if (canEditName) {
                payload.fullName = `${formData.name} ${formData.surname}`.trim()
            }

            // only include email if it's not already set and has a value
            if (!isEmailSet && formData.email?.trim()) {
                payload.email = formData.email.trim()
            }

            if (!user?.user.userId) {
                throw new Error('User ID is undefined.')
            }

            // nothing substantive to update (e.g. a verified user with email
            // already set clicking Save unchanged) — skip the no-op round-trip.
            if (payload.fullName === undefined && payload.email === undefined) {
                router.replace('/profile')
                return
            }

            // updateUserById resolves with { error } on a non-2xx response
            // instead of throwing (e.g. 400 invalid email, 409 email already in
            // use). Surface it instead of navigating away as a false success.
            const result = await updateUserById(payload)
            if (result?.error) {
                setErrorMessage(result.error)
                return
            }

            // refresh user data
            await fetchUser()

            router.replace('/profile')
        } catch (error) {
            console.error('Error updating profile:', error)
            setErrorMessage(tCommon('genericError'))
            Sentry.captureException(error)
        } finally {
            setIsLoading(false)
        }
    }, [formData, user, fetchUser, router, isEmailSet, canEditName, t, tCommon])

    const fullName = user?.user.fullName || user?.user?.username || ''
    const username = user?.user.username || ''

    return (
        <div className="flex flex-col gap-8">
            <NavHeader title={t('title')} onPrev={onBack} />

            <ProfileHeader name={fullName} username={username} isVerified={isKycApproved} />

            {/* two groups — who you are, then how we reach you. gap-6 (XL,
                the section step) against gap-4 (L) inside a group, so the
                rhythm reads 8 (label → field) < 16 (field → field) < 24. */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    <ProfileEditField
                        label={t('fields.name')}
                        value={formData.name}
                        onChange={(value) => handleChange('name', value)}
                        disabled={!canEditName}
                    />

                    <ProfileEditField
                        label={t('fields.surname')}
                        value={formData.surname}
                        onChange={(value) => handleChange('surname', value)}
                        disabled={!canEditName}
                    />

                    <ProfileEditField
                        label={t('fields.bio')}
                        value={formData.bio}
                        onChange={(value) => handleChange('bio', value)}
                        badge={t('soonBadge')}
                        disabled
                    />
                </div>

                <div className="flex flex-col gap-4">
                    <ProfileEditField
                        label={t('fields.email')}
                        value={formData.email}
                        onChange={(value) => handleChange('email', value)}
                        type="email"
                        disabled={isEmailSet}
                    />

                    <ProfileEditField
                        label={t('fields.phoneNumber')}
                        value={formData.phone}
                        onChange={(value) => handleChange('phone', value)}
                        type="tel"
                        badge={t('soonBadge')}
                        disabled
                    />

                    <ProfileEditField
                        label={t('fields.website')}
                        value={formData.website}
                        onChange={(value) => handleChange('website', value)}
                        type="url"
                        badge={t('soonBadge')}
                        disabled
                    />
                </div>

                {/* Name visibility belongs with the name itself; only shown
                    once there is a name to show or hide. */}
                {!!user?.user.fullName?.trim() && (
                    <ListItem
                        position="single"
                        leading={<Icon name="eye" size={24} />}
                        title={tMenu('showMyFullName')}
                        trailing={<ShowNameToggle />}
                    />
                )}
            </div>

            {/* Save renders inline at the end of the form and scrolls with it.
                A sticky footer here covered the Website field, which is the
                last row — the field was unreachable behind the button. Save
                stays gated on `isDirty`, so an untouched form cannot submit. */}
            <div className="flex flex-col gap-4">
                {errorMessage && <Notification priority="error">{errorMessage}</Notification>}

                <Button
                    disabled={isLoading || !isDirty}
                    onClick={handleSave}
                    className="w-full"
                    shadowSize="4"
                    loading={isLoading}
                >
                    {t('saveChanges')}
                </Button>

                <DeleteAccountButton />
            </div>
        </div>
    )
}
