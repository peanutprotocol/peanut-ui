'use client'

import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispEmbedUrl } from '@/hooks/useCrispEmbedUrl'
import { useCrispIframeSessionData } from '@/hooks/useCrispIframeSessionData'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import { useRef } from 'react'

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen, prefilledMessage } = useSupportModalContext()
    const userData = useCrispUserData()
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Build Crisp embed URL with user data as URL parameters (bypasses CORS)
    const crispEmbedUrl = useCrispEmbedUrl(userData)

    // Try to set session:data via JavaScript if CORS allows (for metadata like grafana link)
    useCrispIframeSessionData(iframeRef, userData, prefilledMessage)

    return (
        <Drawer open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
            <DrawerContent className="z-[999999] max-h-[85vh] w-screen pt-4">
                <DrawerTitle className="sr-only">Support</DrawerTitle>
                <iframe ref={iframeRef} src={crispEmbedUrl} className="h-[80vh] w-full" />
            </DrawerContent>
        </Drawer>
    )
}

export default SupportDrawer
