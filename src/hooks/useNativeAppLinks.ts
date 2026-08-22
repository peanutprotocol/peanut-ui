'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { focusManager } from '@tanstack/react-query'
import { captureMessage } from '@/utils/sentry-lazy'
import { isCapacitor } from '@/utils/capacitor'
import { deepLinkToNativePath } from '@/utils/native-routes'
import { sanitizeRedirectURL, saveToCookie, toInviteCode } from '@/utils/general.utils'
import { getOneSignalAdapter } from '@/services/onesignal'

/*
 * App-lifecycle + deep-link listeners (back button, appStateChange focus,
 * App Links, deferred restore, push-tap routing). Mounted in ClientProviders —
 * NOT in a route-group layout — because a cold start that lands on /setup
 * (logged out) must still register getLaunchUrl/appUrlOpen; when this lived in
 * useNativePlugins under (mobile-ui) only, an App Link that cold-started a
 * logged-out install was silently dropped. StatusBar/keyboard styling stays in
 * useNativePlugins: the (setup) layout styles the status bar itself and the
 * two must not race.
 */
let appListenersFailureCaptured = false
let clickListenerFailureCaptured = false

export function useNativeAppLinks() {
    const router = useRouter()

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
            // /invite is rewritten to /setup by the mapper (the landing page is
            // pruned from the native export) — carry the code via the SESSION
            // invite cookie, same semantics as the deferred-link restore: it
            // pre-fills signup but self-heals on restart, so an existing user
            // re-tapping a friend's invite is never locked out of login. The
            // side effect lives here because the mapper runs during render.
            try {
                const parsed = new URL(url, 'https://peanut.me')
                if (parsed.pathname.split('/').filter(Boolean)[0] === 'invite') {
                    const code = toInviteCode(parsed.searchParams.get('code') ?? '')
                    if (code) saveToCookie('inviteCode', code)
                }
            } catch {}
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
                        // eslint-disable-next-line no-restricted-syntax -- native canGoBack guards the call, and the no-history branch must minimize the app (Android convention), which useSafeBack's URL fallback can't express
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
                // may hold up the rest of init (push listener).
                const restoreStartedAt = Date.now()
                import('@/utils/deferred-link')
                    .then(({ restoreDeferredContext }) => restoreDeferredContext())
                    .then((restored) => {
                        if (!restored?.dest) return
                        // a deep link that actually navigated wins the landing
                        if (anyDeepLinkNavigated) return
                        // a restore that resolves late (paste prompt left up for
                        // minutes, sluggish referrer service) must not teleport a
                        // user who is already tapping through onboarding — only
                        // navigate while this still reads as "the app just opened".
                        // cookies + locale above are applied regardless.
                        if (Date.now() - restoreStartedAt > 10_000) return
                        router.push(restored.dest)
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
        }

        init()

        return () => {
            disposed = true
            cleanups.forEach((fn) => fn())
        }
    }, [router])
}
