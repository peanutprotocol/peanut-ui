'use client'

import { useState, useEffect } from 'react'
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
    )
}

export default SupportPage
