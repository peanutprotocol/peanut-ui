'use client'

import { useAuth } from '@/context/authContext'
import Link from 'next/link'

const SupportCTA = () => {
    const { user, isFetchingUser } = useAuth()

    // Show only to guest users
    if (user || isFetchingUser) {
        return null
    }

    return (
        <div className="flex flex-col items-center justify-center border-t border-grey-1">
            <Link href="/support" className="mt-2 cursor-pointer text-sm text-grey-1 underline underline-offset-2">
                Need help with this transaction?
            </Link>
        </div>
    )
}

export default SupportCTA
