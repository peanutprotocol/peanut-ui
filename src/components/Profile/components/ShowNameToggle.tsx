'use client'

import { updateUserById } from '@/app/actions/users'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { useAuth } from '@/context/authContext'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

const ShowNameToggle = () => {
    const t = useTranslations('profile')
    const { fetchUser, user } = useAuth()
    const [showFullName, setShowFullName] = useState(user?.user.showFullName ?? false)

    const handleToggleChange = async () => {
        const newValue = !showFullName
        setShowFullName(newValue)

        // Fire-and-forget: don't await fetchUser() to allow quick navigation
        updateUserById({
            userId: user?.user.userId,
            showFullName: newValue,
        })
            .then(() => {
                // Refetch user data in background without blocking
                fetchUser()
            })
            .catch((error) => {
                console.error('Failed to update preferences:', error)
                // Revert on error
                setShowFullName(!newValue)
            })
    }
    return <Toggle checked={showFullName} onChange={handleToggleChange} aria-label={t('menu.showMyFullName')} />
}

export default ShowNameToggle
