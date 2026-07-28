'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { focusManager } from '@tanstack/react-query'
import { captureMessage } from '@sentry/nextjs'
import { isCapacitor, getPlatform } from '@/utils/capacitor'
import { localeApplied } from '@/i18n/app/locale-store'
import { useAppLocale } from '@/i18n/app/AppIntlProvider'
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
let clickListenerFailureCaptured = false

export function useNativePlugins() {
    const router = useRouter()
    const { setLocale } = useAppLocale()

    useEffect(() => {
        if (!isCapacitor()) return

        const cleanups: Array<() => void> = []
        let disposed = false
        // Registrations resolve async; if the effect tore down first, run the
        // cleanup now instead of leaking the handle.
        const track = (cleanup: () => void) => {
            if (disposed) cleanup()
            else cleanups.push(cleanup)
        }

        // true once ANY deep link actually navigated (cold start, warm start,
        // push tap) — the deferred-restore dest yields only to a navigation
        // that really happened, not to a launch url that was rejected.
        let anyDeepLinkNavigated = false

        const openDeepLink = (url?: string | null): boolean => {
            if (!url) return false
            const target = deepLinkToNativePath(url)
            if (!target) return false
            // same-origin guard: only ever navigate to an in-app relative path
            const safe = sanitizeRedirectURL(target)
            if (!safe) return false
            router.push(safe)
            anyDeepLinkNavigated = true
            return true
        }

        const init = async () => {
            try {
                const { App } = await import('@capacitor/app')

                // TanStack Query's refetchOnWindowFocus keys off visibilitychange,
                // which Android WebViews don't reliably fire on app resume — a
                // resumed app kept rendering its pre-background query data (stale
                // home Activity). Drive the focusManager from the native lifecycle.
                const stateListener = await App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) =>
                    focusManager.setFocused(isActive)
                )
                track(() => {
                    stateListener.remove()
                    focusManager.setFocused(undefined)
                })

                const backListener = await App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
                    if (canGoBack) {
                        router.back()
                    } else {
                        App.minimizeApp()
                    }
                })
                track(() => backListener.remove())

                // App Links: cold start (getLaunchUrl) + warm start (appUrlOpen).
                const launch = await App.getLaunchUrl()
                openDeepLink(launch?.url)
                const urlListener = await App.addListener('appUrlOpen', ({ url }: { url: string }) => openDeepLink(url))
                track(() => urlListener.remove())

                // deferred deep link (store-install hand-off). deliberately NOT
                // awaited: the iOS clipboard read can sit on the system paste
                // prompt and the android referrer service can be slow — neither
                // may hold up the rest of init (push listener, splash hide).
                import('@/utils/deferred-link')
                    .then(({ restoreDeferredContext }) => restoreDeferredContext())
                    .then((restored) => {
                        if (!restored) return
                        // a deep link that actually navigated wins the landing
                        if (restored.dest && !anyDeepLinkNavigated) router.push(restored.dest)
                        if (restored.locale) {
                            const locale = restored.locale
                            // wait for the startup locale to paint so the
                            // provider's initial swap can't clobber ours; the
                            // race guard mirrors the splash-screen timeout
                            Promise.race([localeApplied(), new Promise((r) => setTimeout(r, 3000))])
                                .then(() => setLocale(locale))
                                .catch((e) => console.warn('failed to apply deferred locale:', e))
                        }
                    })
                    .catch((e) => console.warn('deferred link restore failed:', e))
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
                track(
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
                // launch URLs are suppressed in the SDKs, so without this listener a push tap does nothing
                if (!clickListenerFailureCaptured) {
                    clickListenerFailureCaptured = true
                    captureMessage('failed to init notification click listener', {
                        level: 'warning',
                        tags: { feature: 'onesignal', source: 'native_click_listener' },
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
            disposed = true
            cleanups.forEach((fn) => fn())
        }
    }, [router, setLocale])
}
