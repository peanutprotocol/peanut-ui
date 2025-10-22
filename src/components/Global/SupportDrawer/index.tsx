'use client'

import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import { useEffect, useRef } from 'react'

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen, prefilledMessage } = useSupportModalContext()
    const { username, userId, email, grafanaLink } = useCrispUserData()
    const iframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        if (!isSupportModalOpen || !iframeRef.current || !username) return

        const iframe = iframeRef.current

        // Try to set Crisp data in iframe (same as CrispChat.tsx)
        const setCrispDataInIframe = () => {
            try {
                const iframeWindow = iframe.contentWindow as any
                if (!iframeWindow?.$crisp) return

                // Set user nickname and email
                iframeWindow.$crisp.push(['set', 'user:nickname', [username]])
                iframeWindow.$crisp.push(['set', 'user:email', [email]])

                // Set session data - EXACT SAME STRUCTURE as CrispChat.tsx
                iframeWindow.$crisp.push([
                    'set',
                    'session:data',
                    [
                        [
                            ['username', username],
                            ['user_id', userId || ''],
                            ['grafana_dashboard', grafanaLink],
                        ],
                    ],
                ])

                // Set prefilled message if exists
                if (prefilledMessage) {
                    iframeWindow.$crisp.push(['set', 'message:text', [prefilledMessage]])
                }
            } catch (e) {
                // Silently fail if CORS blocks access - no harm done
                console.debug('Could not set Crisp data in iframe (expected if CORS-blocked):', e)
            }
        }

        const handleLoad = () => {
            // Try immediately
            setCrispDataInIframe()

            // Listen for Crisp loaded event in iframe
            try {
                const iframeWindow = iframe.contentWindow as any
                if (iframeWindow?.$crisp) {
                    iframeWindow.$crisp.push(['on', 'session:loaded', setCrispDataInIframe])
                }
            } catch (e) {
                // Ignore CORS errors
            }

            // Fallback: try again after delays (same as CrispChat.tsx)
            setTimeout(setCrispDataInIframe, 500)
            setTimeout(setCrispDataInIframe, 1000)
            setTimeout(setCrispDataInIframe, 2000)
        }

        iframe.addEventListener('load', handleLoad)
        return () => iframe.removeEventListener('load', handleLoad)
    }, [isSupportModalOpen, username, userId, email, grafanaLink, prefilledMessage])

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
