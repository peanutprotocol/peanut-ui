'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { focusManager } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { captureMessage } from '@/utils/sentry-lazy'
import { isCapacitor, openExternalUrl, closeInAppBrowser, markInAppBrowserClosed } from '@/utils/capacitor'
import { deepLinkToNativePath, isNativeExportPath, redactNativePath } from '@/utils/native-routes'
import { BASE_URL } from '@/constants/general.consts'
import { hasDeepLinkNavigated, markDeepLinkNavigated } from '@/utils/deep-link-state'
import { sanitizeRedirectURL } from '@/utils/cookie-url.utils'
import { toInviteCode } from '@/utils/invite-code.utils'
import { getOneSignalAdapter } from '@/services/onesignal'
import { dispatchBackPress } from '@/utils/back-handler'
import { stashInvite } from '@/utils/invite-stash'
import { EInviteType } from '@/services/services.types'

/*
 * App-lifecycle + deep-link listeners (back button, appStateChange focus,
 * App Links, deferred restore, push-tap routing). The back button is offered
 * to the in-app handler stack (open sheets, sub-views, setup steps) before it
 * touches history. Mounted in ClientProviders —
 * NOT in a route-group layout — because a cold start that lands on /setup
 * (logged out) must still register getLaunchUrl/appUrlOpen; when this lived in
 * useNativePlugins under (mobile-ui) only, an App Link that cold-started a
 * logged-out install was silently dropped. StatusBar/keyboard styling stays in
 * useNativePlugins: the (setup) layout styles the status bar itself and the
 * two must not race.
 */
let appListenersFailureCaptured = false
let clickListenerFailureCaptured = false

// Cold-start URL guard: getLaunchUrl returns the ORIGINAL launch URL for the
// whole native process, so every webview reload (logout, hard-nav fallback)
// used to replay a stale claim/pay link. sessionStorage survives reloads but
// dies with the process — exactly the lifetime of "this launch URL was handled".
const HANDLED_LAUNCH_URL_KEY = 'peanut:handledLaunchUrl'

// Double-delivery guard: the same URL can reach openDeepLink twice in one boot
// (explicit getLaunchUrl dispatch + the bridge's own cold-start appUrlOpen
// replay). One navigation is correct; the second is a duplicate history entry.
let lastDispatchedUrl: string | null = null
let lastDispatchedAt = 0

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
        // push tap) — the deferred-restore dest and the landing-page boot
        // redirect yield only to a navigation that really happened, not to a
        // launch url that was rejected. Module state (deep-link-state.ts) so
        // LandingPageCapacitorGate can read it without a render dependency.
        let anyDeepLinkNavigated = false

        // Until this instrumentation, no deep link left any trace unless it
        // threw — "links don't work" was undiagnosable from telemetry.
        //
        // Route family only. A claim link carries its password in
        // `#p=<password>`, which deepLinkToNativePath deliberately preserves
        // (native-routes.ts) because the claim page needs it — and that password
        // derives the private claim key, so anyone reading analytics could claim
        // the funds. The query is dropped for the same reason (charge and request
        // ids), and path segments are normalized because identifiers travel there
        // too: `/qr/<code>` is a bearer secret until the user claims the QR.
        // Which route was opened and whether it navigated is the whole
        // diagnostic value. See `redactNativePath`.
        const redactLink = <T extends string | null>(value: T): T =>
            (value === null ? value : redactNativePath(value)) as T

        const captureLink = (source: string, raw: string, mapped: string | null, outcome: string) =>
            posthog.capture('native_link_received', {
                source,
                raw: redactLink(raw),
                mapped: redactLink(mapped),
                outcome,
                dropped: outcome === 'dropped',
            })

        const openDeepLink = (url?: string | null, source = 'app_url'): boolean => {
            if (!url) return false
            // Same URL twice in one boot = cold-start double delivery
            // (getLaunchUrl + the bridge's appUrlOpen replay) — one nav is right.
            if (url === lastDispatchedUrl && Date.now() - lastDispatchedAt < 3000) return true
            const target = deepLinkToNativePath(url)
            if (!target) {
                /*
                 * A peanut.me path with no native stand-in (blog, help, legal,
                 * locale pages…) opens the real web page in the in-app browser
                 * instead of silently eating the tap. Off-domain URLs stay with
                 * the caller — the push handler hands those to the system
                 * browser itself. The bare origin is excluded: it maps to the
                 * marketing landing, which is noise for someone already in the app.
                 */
                try {
                    const parsed = new URL(url, 'https://peanut.me')
                    const isAppHost = /^(.+\.)?peanut\.me$/.test(parsed.hostname)
                    if (isAppHost && (parsed.pathname !== '/' || parsed.search)) {
                        lastDispatchedUrl = url
                        lastDispatchedAt = Date.now()
                        openExternalUrl(parsed.href).catch((e) => console.warn('failed to open web-only link:', e))
                        captureLink(source, url, null, 'in_app_browser')
                        return true
                    }
                } catch {}
                captureLink(source, url, null, 'dropped')
                return false
            }
            // same-origin guard: only ever navigate to an in-app relative path
            const safe = sanitizeRedirectURL(target)
            if (!safe) {
                captureLink(source, url, target, 'dropped')
                return false
            }
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
                    if (code) stashInvite(code, EInviteType.DIRECT)
                }
            } catch {}
            lastDispatchedUrl = url
            lastDispatchedAt = Date.now()
            // Flag first (synchronously): the landing gate's /home replace races
            // this push on cold start and must yield to it.
            anyDeepLinkNavigated = true
            markDeepLinkNavigated()
            /*
             * A deep link arriving while our in-app browser sheet is up (the
             * Persona/Bridge KYC return leg) must dismiss it or the nav happens
             * underneath a full-screen browser. Sequence the push after the
             * close, but cap the wait: a wedged Browser.close (the silent-
             * native-failure class) must degrade to navigating behind the
             * sheet, never to an eaten tap.
             */
            void Promise.race([closeInAppBrowser(), new Promise((r) => setTimeout(r, 500))]).finally(() => {
                router.push(safe)
                captureLink(source, url, safe, 'navigated')
            })
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
                    if (dispatchBackPress()) return
                    if (canGoBack) {
                        // eslint-disable-next-line no-restricted-syntax -- native canGoBack guards the call, and the no-history branch must minimize the app (Android convention), which useSafeBack's URL fallback can't express
                        router.back()
                    } else {
                        App.minimizeApp()
                    }
                })
                track(() => backListener.remove())

                // App Links: cold start (getLaunchUrl) + warm start (appUrlOpen).
                // getLaunchUrl returns the original launch URL for the whole
                // process, so it is dispatched at most once per launch URL —
                // without the sessionStorage guard every webview reload (logout,
                // hard-nav fallback) replayed a stale claim/pay link.
                // hasDeepLinkNavigated(): RootRedirect may already have routed
                // this same launch URL (a full-document load recovers it from
                // location) — dispatching it again would double-navigate.
                const launch = await App.getLaunchUrl()
                if (launch?.url) {
                    // Stamp BEFORE the hasDeepLinkNavigated() check: on the
                    // RootRedirect path the URL is already handled, and skipping
                    // the stamp let the next reload (module state gone,
                    // getLaunchUrl unchanged) replay it.
                    let alreadyHandled = false
                    try {
                        alreadyHandled = sessionStorage.getItem(HANDLED_LAUNCH_URL_KEY) === launch.url
                        if (!alreadyHandled) sessionStorage.setItem(HANDLED_LAUNCH_URL_KEY, launch.url)
                    } catch {}
                    if (!alreadyHandled && !hasDeepLinkNavigated()) openDeepLink(launch.url, 'launch_url')
                }
                const urlListener = await App.addListener('appUrlOpen', ({ url }: { url: string }) =>
                    openDeepLink(url, 'app_url_open')
                )
                track(() => urlListener.remove())

                // Keep the in-app-browser flag honest when the user dismisses
                // the sheet themselves.
                import('@capacitor/browser')
                    .then(({ Browser }) =>
                        Browser.addListener('browserFinished', () => markInAppBrowserClosed()).then((l) =>
                            track(() => l.remove())
                        )
                    )
                    .catch(() => {})

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
                        if (anyDeepLinkNavigated) {
                            captureLink('deferred', restored.dest, restored.dest, 'yielded')
                            return
                        }
                        // a restore that resolves late (paste prompt left up for
                        // minutes, sluggish referrer service) must not teleport a
                        // user who is already tapping through onboarding — only
                        // navigate while this still reads as "the app just opened".
                        // cookies + locale above are applied regardless.
                        if (Date.now() - restoreStartedAt > 10_000) {
                            captureLink('deferred', restored.dest, restored.dest, 'expired')
                            return
                        }
                        markDeepLinkNavigated()
                        router.push(restored.dest)
                        captureLink('deferred', restored.dest, restored.dest, 'navigated')
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
                        // rather than silently swallowing the tap. peanut.me links
                        // always go through openDeepLink — it opens web-only paths
                        // in the in-app browser itself.
                        if (
                            link &&
                            /^https:\/\//i.test(link) &&
                            !/^https:\/\/([^/]*\.)?peanut\.me(\/|\?|#|$)/i.test(link)
                        ) {
                            openExternalUrl(link).catch((e) => console.warn('failed to open external push link:', e))
                            captureLink('push', link, null, 'external_browser')
                            return
                        }
                        openDeepLink(link, 'push')
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

        /*
         * Raw `<a target="_blank">` anchors with external hrefs (card terms,
         * passkey help, block explorers, attachments) hand the URL to the OS on
         * Android and are a silent no-op on iOS. Intercept at capture phase and
         * route through the in-app browser. Only the navigation is prevented —
         * propagation continues, so React handlers on the anchor still run.
         *
         * Relative anchors to routes missing from the native export (marketing,
         * help, legal — e.g. the /shhhhh footer's links) are intercepted too:
         * next/link would client-navigate them into the SPA's 404 → home
         * fallback. Those open the real web page in the in-app browser, and
         * DO stop propagation — the React handler there is next/link's
         * router.push, which must not run.
         */
        const onDocumentClick = (e: MouseEvent) => {
            const anchor = (e.target as Element | null)?.closest?.('a[href]')
            if (!anchor) return
            const href = anchor.getAttribute('href')
            if (!href) return
            if (/^https?:\/\//i.test(href)) {
                if (anchor.getAttribute('target') !== '_blank') return
                e.preventDefault()
                openExternalUrl(href).catch((err) => console.warn('failed to open external link:', err))
                return
            }
            if (href.startsWith('/') && !isNativeExportPath(href)) {
                e.preventDefault()
                e.stopPropagation()
                openExternalUrl(`${BASE_URL}${href}`).catch((err) => console.warn('failed to open web-only link:', err))
            }
        }
        document.addEventListener('click', onDocumentClick, true)
        cleanups.push(() => document.removeEventListener('click', onDocumentClick, true))

        return () => {
            disposed = true
            cleanups.forEach((fn) => fn())
        }
    }, [router])
}
