'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { captureMessage } from '@sentry/nextjs'
import { isCapacitor, getPlatform } from '@/utils/capacitor'
import { localeApplied } from '@/i18n/app/locale-store'
import { deepLinkToNativePath } from '@/utils/native-routes'
import { sanitizeRedirectURL } from '@/utils/general.utils'
import { getOneSignalAdapter } from '@/services/onesignal'

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
                // Push taps: the OneSignal SDKs are configured not to open the
                // launch URL themselves (suppressLaunchURLs / OneSignal_suppress_launch_urls),
                // so routing is ours. `additionalData.deepLink` is the canonical
                // relative path the API sends; the launch URL is the fallback for
                // notifications sent before that field existed.
                const adapter = await getOneSignalAdapter()
                cleanups.push(
                    adapter.onNotificationClick(({ deepLink, additionalData }) => {
                        const target = additionalData.deepLink
                        const link = typeof target === 'string' ? target : deepLink
                        // Off-domain https links (operator sends) can't route in-app;
                        // with launch URLs suppressed, hand them to the system browser
                        // rather than silently swallowing the tap.
                        if (link && !deepLinkToNativePath(link) && /^https:\/\//i.test(link)) {
                            import('@capacitor/browser')
                                .then(({ Browser }) => Browser.open({ url: link }))
                                .catch((e) => console.warn('failed to open external push link:', e))
                            return
                        }
                        openDeepLink(link)
                    })
                )
            } catch (e) {
                console.warn('failed to init notification click listener:', e)
            }

            try {
                const { StatusBar, Style } = await import('@capacitor/status-bar')
                await StatusBar.setOverlaysWebView({ overlay: false })
                // Black status-bar strip with light icons, everywhere. On Android 15+
                // edge-to-edge these are no-ops and the CSS safe zone in the layout
                // paints the black behind the status bar instead.
                await StatusBar.setStyle({ style: Style.Dark })
                await StatusBar.setBackgroundColor({ color: '#000000' })
            } catch (e) {
                console.warn('failed to init status bar:', e)
            }

            try {
                // hold the splash until the startup locale has painted, so
                // es/pt users never see an English flash. The timeout guard
                // means an i18n bug can never keep the splash up.
                await Promise.race([localeApplied(), new Promise((resolve) => setTimeout(resolve, 2000))])
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
