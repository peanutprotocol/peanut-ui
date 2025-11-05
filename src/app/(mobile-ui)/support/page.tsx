'use client'

import { useEffect } from 'react'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispProxyUrl } from '@/hooks/useCrispProxyUrl'
import { CrispIframe } from '@/components/Global/CrispIframe'

const SupportPage = () => {
    const userData = useCrispUserData()
    const crispProxyUrl = useCrispProxyUrl(userData)

    // Debug logging for iOS
    useEffect(() => {
        console.log('[SupportPage] Mounted', {
            crispProxyUrl,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
            windowHeight: typeof window !== 'undefined' ? window.innerHeight : 'SSR',
        })
    }, [crispProxyUrl])

    return (
        <div
            className="relative w-full md:max-w-[90%] md:pl-24"
            style={{
                height: '100%',
                minHeight: '100vh',
                background: 'var(--background)',
            }}
        >
            <CrispIframe crispProxyUrl={crispProxyUrl} />
        </div>
    )
}

export default SupportPage
