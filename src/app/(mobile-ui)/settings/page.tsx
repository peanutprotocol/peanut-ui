'use client'

import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useQueryClient } from '@tanstack/react-query'

const SettingsPage = () => {
    const { logoutUser } = useAuth()
    const queryClient = useQueryClient()

    return (
        <div className="flex min-h-screen w-full flex-col justify-center p-2 sm:p-5 md:p-10">
            <Button
                onClick={() => {
                    logoutUser()
                    queryClient.invalidateQueries()
                }}
            >
                Logout
            </Button>
        </div>
    )
}

export default SettingsPage
