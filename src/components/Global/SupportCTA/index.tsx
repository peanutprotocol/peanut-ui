'use client'

import Link from 'next/link'

const SupportCTA = () => {
    return (
        <div className="flex flex-col items-center justify-center">
            <Link href="/support" className="mt-2 cursor-pointer text-sm text-grey-1 underline underline-offset-2">
                Need help with this transaction?
            </Link>
        </div>
    )
}

export default SupportCTA
