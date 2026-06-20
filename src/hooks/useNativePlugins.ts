'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isCapacitor } from '@/utils/capacitor'

/**
 * initializes capacitor native plugins (back button, status bar, splash screen).
 * call once in the root layout or a top-level provider.
 * plugins are loaded via dynamic import with webpackIgnore since they only
 * exist in native builds (not on vercel/web ci).
 */
export function useNativePlugins() {
    const router = useRouter()

    useEffect(() => {
        if (!isCapacitor()) return

        let cleanup: (() => void) | undefined

        const init = async () => {
            try {
                const { App } = await import('@capacitor/app')
                const listener = await App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
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

            try {
                const { StatusBar, Style } = await import('@capacitor/status-bar')
                await StatusBar.setOverlaysWebView({ overlay: false })
                await StatusBar.setStyle({ style: Style.Light })
                await StatusBar.setBackgroundColor({ color: '#ffffff' })
            } catch (e) {
                console.warn('failed to init status bar:', e)
            }

            try {
                const { SplashScreen } = await import('@capacitor/splash-screen')
                await SplashScreen.hide()
            } catch (e) {
                console.warn('failed to hide splash screen:', e)
            }

            try {
                // Resize the webview when the soft keyboard appears so inputs on
                // amount / send / invite screens aren't hidden behind it.
                const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
                await Keyboard.setResizeMode({ mode: KeyboardResize.Native })
            } catch (e) {
                console.warn('failed to configure keyboard:', e)
            }
        }

        init()

        return () => {
            cleanup?.()
        }
    }, [router])
}
