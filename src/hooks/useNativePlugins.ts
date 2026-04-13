'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isCapacitor } from '@/utils/capacitor'

/**
 * initializes capacitor native plugins (back button, status bar, splash screen).
 * call once in the root layout or a top-level provider.
 */
export function useNativePlugins() {
    const router = useRouter()

    useEffect(() => {
        if (!isCapacitor()) return

        let cleanup: (() => void) | undefined

        const init = async () => {
            // android back button — navigate back or minimize app
            try {
                const { App } = await import('@capacitor/app')
                const listener = await App.addListener('backButton', ({ canGoBack }) => {
                    if (canGoBack) {
                        router.back()
                    } else {
                        App.minimizeApp()
                    }
                })
                cleanup = () => listener.remove()
            } catch (e) {
                console.warn('failed to init back button handler:', e)
            }

            // status bar — light content on dark background
            try {
                const { StatusBar, Style } = await import('@capacitor/status-bar')
                await StatusBar.setStyle({ style: Style.Light })
                await StatusBar.setBackgroundColor({ color: '#ffffff' })
            } catch (e) {
                console.warn('failed to init status bar:', e)
            }

            // splash screen — hide after app is ready
            try {
                const { SplashScreen } = await import('@capacitor/splash-screen')
                await SplashScreen.hide()
            } catch (e) {
                console.warn('failed to hide splash screen:', e)
            }
        }

        init()

        return () => {
            cleanup?.()
        }
    }, [router])
}
