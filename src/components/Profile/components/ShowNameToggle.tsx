'use client'

import { updateUserById } from '@/app/actions/users'
import Loading from '@/components/Global/Loading'
import { useAuth } from '@/context/authContext'
import { useState } from 'react'

const ShowNameToggle = () => {
    const { fetchUser, user } = useAuth()
    const [isToggleLoading, setIsToggleLoading] = useState(false)
    const [showFullName, setShowFullName] = useState(user?.user.showFullName ?? false)

    const handleToggleChange = async () => {
        if (isToggleLoading) return

        setIsToggleLoading(true)
        try {
            setShowFullName(!showFullName)
            await updateUserById({
                userId: user?.user.userId,
                showFullName: !showFullName,
            })
            await fetchUser()
        } catch (error) {
            console.error('Failed to update preferences:', error)
        } finally {
            setIsToggleLoading(false)
        }
    }
    return (
        <button
            onClick={handleToggleChange}
            disabled={isToggleLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full border border-black transition-colors duration-200 ease-in-out focus:outline-none ${
                isToggleLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
        >
            {isToggleLoading ? (
                <div className="flex h-full w-full items-center justify-center">
                    <Loading className="h-3 w-3" />
                </div>
            ) : (
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-primary-1 transition-transform duration-200 ease-in-out ${
                        showFullName ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            )}
        </button>
    )
}

export default ShowNameToggle
