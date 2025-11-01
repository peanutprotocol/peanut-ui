'use client'

import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispIframeInitialization } from '@/hooks/useCrispIframeInitialization'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import { useRef } from 'react'

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen, prefilledMessage } = useSupportModalContext()
    const userData = useCrispUserData()
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Initialize Crisp user data in iframe
    useCrispIframeInitialization(iframeRef, userData, prefilledMessage, isSupportModalOpen && !!userData.userId)

    return (
        <Drawer open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
            <DrawerContent className="z-[999999] max-h-[85vh] w-screen pt-4">
                <DrawerTitle className="sr-only">Support</DrawerTitle>
                <iframe
                    ref={iframeRef}
                    src="https://go.crisp.chat/chat/embed/?website_id=916078be-a6af-4696-82cb-bc08d43d9125"
                    className="h-[80vh] w-full"
                />
            </DrawerContent>
        </Drawer>
    )
}

export default SupportDrawer
