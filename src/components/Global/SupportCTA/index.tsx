'use client'

import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'

const SupportCTA = () => {
    const router = useRouter()
    const { user } = useAuth()

    // Show only to guest users
    if (user) {
        return null
    }

    return (
        <div className="flex flex-col items-center justify-center border-t border-grey-1">
            <p
                onClick={() => router.push('/support')}
                className="mt-2 cursor-pointer text-sm text-grey-1 underline underline-offset-2"
            >
                Need help with this transaction?
            </p>
        </div>
    )
}

export default SupportCTA
