'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { captureMessage } from '@sentry/nextjs'
import { isCapacitor, getPlatform } from '@/utils/capacitor'
import { deepLinkToNativePath } from '@/utils/native-routes'
import { sanitizeRedirectURL } from '@/utils/general.utils'

/**
 * initializes capacitor native plugins (back button, status bar, splash screen).
 * call once in the root layout or a top-level provider.
 * plugins are loaded via dynamic import with webpackIgnore since they only
 * exist in native builds (not on vercel/web ci).
 */
let appListenersFailureCaptured = false

export function useNativePlugins() {
    const router = useRouter()

    useEffect(() => {
        if (!isCapacitor()) return

        const cleanups: Array<() => void> = []

        const openDeepLink = (url?: string | null) => {
            if (!url) return
            const target = deepLinkToNativePath(url)
            if (!target) return
            // same-origin guard: only ever navigate to an in-app relative path
            const safe = sanitizeRedirectURL(target)
            if (safe) router.push(safe)
        }

        const init = async () => {
            try {
                const { App } = await import('@capacitor/app')
                const backListener = await App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
                    if (canGoBack) {
                        router.back()
                    } else {
                        App.minimizeApp()
                    }
                })
                cleanups.push(() => backListener.remove())

                // App Links: cold start (getLaunchUrl) + warm start (appUrlOpen).
                const launch = await App.getLaunchUrl()
                openDeepLink(launch?.url)
                const urlListener = await App.addListener('appUrlOpen', ({ url }: { url: string }) => openDeepLink(url))
                cleanups.push(() => urlListener.remove())
            } catch (e) {
                console.warn('failed to init app listeners:', e)
                // without these listeners push-tap deep links never route, so surface the failure
                if (!appListenersFailureCaptured) {
                    appListenersFailureCaptured = true
                    captureMessage('failed to init native app listeners', {
                        level: 'warning',
                        tags: { feature: 'onesignal', source: 'native_app_listeners' },
                        extra: { error: e instanceof Error ? e.message : String(e) },
                    })
                }
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

            // Resize the webview when the soft keyboard appears so inputs on
            // amount / send / invite screens aren't hidden behind it. setResizeMode
            // is an iOS API — Android throws "not implemented" and handles resize via
            // the manifest's windowSoftInputMode=adjustResize instead.
            if (getPlatform() === 'ios-native') {
                try {
                    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
                    await Keyboard.setResizeMode({ mode: KeyboardResize.Native })
                } catch (e) {
                    console.warn('failed to configure keyboard:', e)
                }
            }
        }

        init()

        return () => {
            cleanups.forEach((fn) => fn())
        }
    }, [router])
}
