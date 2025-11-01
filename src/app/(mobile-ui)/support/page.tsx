'use client'

import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispIframeInitialization } from '@/hooks/useCrispIframeInitialization'
import { useRef } from 'react'

const SupportPage = () => {
    const userData = useCrispUserData()
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Initialize Crisp user data in iframe
    useCrispIframeInitialization(iframeRef, userData, undefined, !!userData.userId)

    return (
        <iframe
            ref={iframeRef}
            src="https://go.crisp.chat/chat/embed/?website_id=916078be-a6af-4696-82cb-bc08d43d9125"
            className="h-full w-full md:max-w-[90%] md:pl-24"
        />
    )
}

export default SupportPage
