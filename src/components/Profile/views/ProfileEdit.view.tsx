'use client'
import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import ProfileEditField from '../components/ProfileEditField'
import ProfileHeader from '../components/ProfileHeader'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useSafeBack } from '@/hooks/useSafeBack'

export const ProfileEditView = () => {
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

    // populate name and surname from fullName
    useEffect(() => {
        if (user?.user.fullName) {
            const { name, surname } = splitName(user.user.fullName)
            setFormData((prev) => ({
                ...prev,
                name,
                surname,
                email: user.user.email || '',
            }))
        }
    }, [user?.user.fullName, user?.user.email, splitName])

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
                setErrorMessage('Please provide your name.')
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
            setErrorMessage('Something went wrong. Please try again or contact support.')
            Sentry.captureException(error)
        } finally {
            setIsLoading(false)
        }
    }, [formData, user, fetchUser, router, isEmailSet, canEditName])

    const fullName = user?.user.fullName || user?.user?.username || ''
    const username = user?.user.username || ''

    return (
        <div className="space-y-8">
            <NavHeader title="Edit Profile" onPrev={onBack} />

            <ProfileHeader name={fullName} username={username} isVerified={isKycApproved} />

            <div className="space-y-4">
                <ProfileEditField
                    label="Name"
                    value={formData.name}
                    onChange={(value) => handleChange('name', value)}
                    placeholder="Add your name"
                    disabled={!canEditName}
                />

                <ProfileEditField
                    label="Surname"
                    value={formData.surname}
                    onChange={(value) => handleChange('surname', value)}
                    placeholder="Add your surname"
                    disabled={!canEditName}
                />

                <ProfileEditField
                    label="Bio"
                    value={formData.bio}
                    onChange={(value) => handleChange('bio', value)}
                    placeholder="Add a bio"
                    badge="Soon!"
                    disabled
                />

                <ProfileEditField
                    label="Email"
                    value={formData.email}
                    onChange={(value) => handleChange('email', value)}
                    placeholder="Add your email"
                    type="email"
                    disabled={isEmailSet}
                />

                <ProfileEditField
                    label="Phone number"
                    value={formData.phone}
                    onChange={(value) => handleChange('phone', value)}
                    placeholder="Add your number"
                    type="tel"
                    badge="Soon!"
                    disabled
                />

                <ProfileEditField
                    label="Website"
                    value={formData.website}
                    onChange={(value) => handleChange('website', value)}
                    placeholder="Add your website"
                    type="url"
                    badge="Soon!"
                    disabled
                />

                <div className="space-y-5 pb-10">
                    <Button
                        disabled={isLoading}
                        onClick={handleSave}
                        className="w-full"
                        shadowSize="4"
                        loading={isLoading}
                    >
                        Save Changes
                    </Button>

                    {errorMessage && <ErrorAlert description={errorMessage} />}
                </div>
            </div>
        </div>
    )
}
