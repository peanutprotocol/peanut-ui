'use client'

import { updateUserById } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { useState } from 'react'

const ShowNameToggle = () => {
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
    return (
        <button
            onClick={handleToggleChange}
            className="relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none"
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full transition-all duration-200 ease-in-out ${
                    showFullName ? 'translate-x-6 bg-primary-1' : 'translate-x-1 bg-gray-1'
                }`}
            />
        </button>
    )
}

export default ShowNameToggle
