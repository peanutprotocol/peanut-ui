'use client'

import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispEmbedUrl } from '@/hooks/useCrispEmbedUrl'
import { useCrispIframeSessionData } from '@/hooks/useCrispIframeSessionData'
import { useRef } from 'react'

const SupportPage = () => {
    const userData = useCrispUserData()
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Build Crisp embed URL with user data as URL parameters (bypasses CORS)
    const crispEmbedUrl = useCrispEmbedUrl(userData)

    // Try to set session:data via JavaScript if CORS allows (for metadata like grafana link)
    useCrispIframeSessionData(iframeRef, userData)

    return <iframe ref={iframeRef} src={crispEmbedUrl} className="h-full w-full md:max-w-[90%] md:pl-24" />
}

export default SupportPage
