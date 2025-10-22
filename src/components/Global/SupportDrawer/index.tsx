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
        if (!isSupportModalOpen || !iframeRef.current) return

        const iframe = iframeRef.current

        const setCrispDataInIframe = () => {
            try {
                const iframeWindow = iframe.contentWindow as any
                if (!iframeWindow?.$crisp) return

                // Set user data in iframe's Crisp instance (same as CrispChat.tsx)
                iframeWindow.$crisp.push(['set', 'user:nickname', [username]])
                iframeWindow.$crisp.push(['set', 'user:email', [email]])

                // Set session data with Grafana link and user_id
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
                console.error('Error setting Crisp data in iframe:', e)
            }
        }

        // Wait for iframe to load and Crisp to initialize
        const handleLoad = () => {
            // Try multiple times as Crisp takes time to initialize
            const attempts = [500, 1000, 2000, 3000]
            attempts.forEach((delay) => {
                setTimeout(setCrispDataInIframe, delay)
            })
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
