'use client'

import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'

const SettingsPage = () => {
    const { logoutUser } = useAuth()

    return (
        <div className="flex min-h-screen w-full flex-col justify-center p-2 sm:p-5 md:p-10">
            <Button
                onClick={() => {
                    logoutUser()
                }}
            >
                Logout
            </Button>
        </div>
    )
}

export default SettingsPage
