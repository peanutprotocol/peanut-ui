'use client'

import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { setCrispUserData } from '@/utils/crisp'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import { useEffect, useRef } from 'react'

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen, prefilledMessage } = useSupportModalContext()
    const userData = useCrispUserData()
    const iframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        if (!isSupportModalOpen || !iframeRef.current || !userData.username) return

        const iframe = iframeRef.current

        // Try to set Crisp data in iframe (same logic as CrispChat.tsx)
        const setData = () => {
            try {
                const iframeWindow = iframe.contentWindow as any
                if (!iframeWindow?.$crisp) return

                setCrispUserData(iframeWindow.$crisp, userData, prefilledMessage)
            } catch (e) {
                // Silently fail if CORS blocks access - no harm done
                console.debug('Could not set Crisp data in iframe (expected if CORS-blocked):', e)
            }
        }

        const handleLoad = () => {
            // Try immediately
            setData()

            // Listen for Crisp loaded event in iframe
            try {
                const iframeWindow = iframe.contentWindow as any
                if (iframeWindow?.$crisp) {
                    iframeWindow.$crisp.push(['on', 'session:loaded', setData])
                }
            } catch (e) {
                // Ignore CORS errors
            }

            // Fallback: try again after delays
            setTimeout(setData, 500)
            setTimeout(setData, 1000)
            setTimeout(setData, 2000)
        }

        iframe.addEventListener('load', handleLoad)
        return () => iframe.removeEventListener('load', handleLoad)
    }, [isSupportModalOpen, userData, prefilledMessage])

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
