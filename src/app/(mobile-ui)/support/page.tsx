'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispProxyUrl } from '@/hooks/useCrispProxyUrl'
import PeanutLoading from '@/components/Global/PeanutLoading'

const SupportPage = () => {
    const userData = useCrispUserData()
    const crispProxyUrl = useCrispProxyUrl(userData)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Listen for ready message from proxy iframe
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return

            if (event.data.type === 'CRISP_READY') {
                setIsLoading(false)
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    return (
        <div className="relative h-full w-full md:max-w-[90%] md:pl-24">
            <div className="flex items-center justify-between border-b border-n-1/10 px-4 py-2">
                <Link href="/help" className="text-sm text-black underline">
                    Browse help articles
                </Link>
            </div>
            <div className="relative h-[calc(100%-40px)] w-full">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                        <PeanutLoading />
                    </div>
                )}
                <iframe
                    src={crispProxyUrl}
                    className="h-full w-full"
                    allow="storage-access *"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-storage-access-by-user-activation"
                    title="Support Chat"
                />
            </div>
        </div>
    )
}

export default SupportPage
