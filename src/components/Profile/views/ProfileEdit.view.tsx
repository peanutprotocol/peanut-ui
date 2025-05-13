'use client'
import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import ProfileEditField from '../components/ProfileEditField'
import ProfileHeader from '../components/ProfileHeader'

export const ProfileEditView = () => {
    const router = useRouter()
    const { user, fetchUser } = useAuth()
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

    // populate name and surname from full_name
    useEffect(() => {
        if (user?.user.full_name) {
            const { name, surname } = splitName(user.user.full_name)
            setFormData((prev) => ({
                ...prev,
                name,
                surname,
                email: user.user.email || '',
            }))
        }
    }, [user?.user.full_name, user?.user.email, splitName])

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

            // validate form data
            if (!formData.name?.trim()) {
                setErrorMessage('Please provide your name.')
                return
            }

            // combine name and surname for full_name
            const fullName = `${formData.name} ${formData.surname}`.trim()

            // prepare request payload
            const payload: Record<string, any> = {
                userId: user?.user.userId,
                fullName: fullName,
            }

            // only include email if it's not already set and has a value
            if (!isEmailSet && formData.email?.trim()) {
                payload.email = formData.email.trim()
            }

            if (!user?.user.userId) {
                throw new Error('User ID is undefined.')
            }

            // update user profile
            await updateUserById(payload)

            // refresh user data
            await fetchUser()

            router.push('/profile')
        } catch (error) {
            console.error('Error updating profile:', error)
            setErrorMessage('Something went wrong. Please try again or contact support.')
            Sentry.captureException(error)
        } finally {
            setIsLoading(false)
        }
    }, [formData, user, fetchUser, router, isEmailSet])

    const fullName = user?.user.full_name || user?.user?.username || ''
    const username = user?.user.username || ''

    return (
        <div className="space-y-8">
            <NavHeader title="Edit Profile" onPrev={() => router.push('/profile')} />

            <ProfileHeader name={fullName} username={username} isVerified={user?.user.kycStatus === 'approved'} />

            <div className="space-y-4">
                <ProfileEditField
                    label="Name"
                    value={formData.name}
                    onChange={(value) => handleChange('name', value)}
                    placeholder="Add your name"
                />

                <ProfileEditField
                    label="Surname"
                    value={formData.surname}
                    onChange={(value) => handleChange('surname', value)}
                    placeholder="Add your surname"
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
