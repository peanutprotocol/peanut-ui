'use client'

import { useState, useEffect } from 'react'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispProxyUrl } from '@/hooks/useCrispProxyUrl'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import PeanutLoading from '../PeanutLoading'

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen, prefilledMessage } = useSupportModalContext()
    const userData = useCrispUserData()
    const [isLoading, setIsLoading] = useState(true)

    const crispProxyUrl = useCrispProxyUrl(userData, prefilledMessage)

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

    // Reset loading state when drawer closes
    useEffect(() => {
        if (!isSupportModalOpen) {
            setIsLoading(true)
        }
    }, [isSupportModalOpen])

    return (
        <Drawer open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
            <DrawerContent className="z-[999999] max-h-[85vh] w-screen pt-4">
                <DrawerTitle className="sr-only">Support</DrawerTitle>
                <div className="relative h-[80vh] w-full">
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                            <PeanutLoading />
                        </div>
                    )}
                    <iframe src={crispProxyUrl} className="h-full w-full" title="Support Chat" />
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default SupportDrawer
