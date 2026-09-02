'use client'

/**
 * wrapper for client-side providers
 *
 * groups all client providers in one place, keeping the root layout clean.
 * the root layout (server component) renders this single client boundary.
 */
import { ConsoleGreeting } from '@/components/Global/ConsoleGreeting'
import { ScreenOrientationLocker } from '@/components/Global/ScreenOrientationLocker'
import { TranslationSafeWrapper } from '@/components/Global/TranslationSafeWrapper'
import { UnsupportedWebViewScreen, hasUnsupportedWebViewBypass } from '@/components/Global/UnsupportedWebViewScreen'
import { MarketingIntlProvider } from '@/i18n/app/MarketingIntlProvider'
import { PeanutProvider } from '@/config/peanut.config'
import { ContextProvider } from '@/context/contextProvider'
import { FooterVisibilityProvider } from '@/context/footerVisibility'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { HARNESS_ENABLED } from '@/constants/harness.consts'
import { useNativeAppLinks } from '@/hooks/useNativeAppLinks'
import { useOtaUpdates } from '@/hooks/useOtaUpdates'
import { useSplashGate } from '@/hooks/useSplashGate'
import { useZeroLegacyAndroidSafeAreaInsets } from '@/hooks/useZeroLegacyAndroidSafeAreaInsets'
import { applyLegacyAndroidSafeAreaZeroFromUserAgent, isCapacitor, isWebViewCssSupported } from '@/utils/capacitor'
import { isMarketingRoute } from '@/utils/marketing-routes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'

// Harness bootstrap ships only in harness builds. In prod bundles the dynamic
// import is in dead code behind `if (false)` and webpack drops the chunk.
const HarnessBootstrap = HARNESS_ENABLED
    ? dynamic(() => import('@/context/HarnessBootstrap').then((m) => m.HarnessBootstrap), {
          ssr: false,
      })
    : null

// /dev/devices viewport harness: every pane runs this agent so the panes mirror
// each other's route, scroll, input and clicks. Same build-time gate as the
// page, so prod folds it to dead code. No-ops outside a pane, so a normal tab
// is unaffected.
if (DEV_TOOLS_ENABLED && typeof window !== 'undefined') {
    import('@/dev/devsync-agent').then((m) => m.initDevsyncAgent())
}

// Module scope so it lands before hydration: the first paint on Android < 15
// would otherwise show the phantom safe-area band until the async Device.getInfo
// pass (useZeroLegacyAndroidSafeAreaInsets, still authoritative) corrects it.
if (typeof window !== 'undefined') applyLegacyAndroidSafeAreaZeroFromUserAgent()

// Decided once at load, client only. A WebView that cannot parse the
// stylesheet gets the inline-styled update screen in place of the app tree.
const UNSUPPORTED_WEBVIEW =
    typeof window !== 'undefined' && isCapacitor() && !isWebViewCssSupported() && !hasUnsupportedWebViewBypass()

const AppGlobals = dynamic(() => import('./AppGlobals').then((m) => m.AppGlobals))
// The full message catalog is 129 KB; app routes load it as their own chunk.
const AppIntlProvider = dynamic(() => import('@/i18n/app/AppIntlProvider').then((m) => m.AppIntlProvider))

export function ClientProviders({ children }: { children: React.ReactNode }) {
    // initialize capgo ota updates (calls notifyAppReady on mount, no-op on web)
    useOtaUpdates()
    useSplashGate()
    // App Links + push-tap routing must be registered on EVERY cold-start
    // destination (including logged-out /setup), hence here and not (mobile-ui).
    useNativeAppLinks()
    useZeroLegacyAndroidSafeAreaInsets()

    // The marketing site renders without the wallet provider tree, so the
    // globals that depend on it are not mounted there either. `isMarketingRoute`
    // fails safe: an unrecognised path gets the full app tree.
    const marketing = isMarketingRoute(usePathname())
    const IntlProvider = marketing ? MarketingIntlProvider : AppIntlProvider

    if (UNSUPPORTED_WEBVIEW) {
        return (
            <AppIntlProvider>
                <UnsupportedWebViewScreen />
            </AppIntlProvider>
        )
    }

    return (
        <NuqsAdapter>
            <PeanutProvider>
                {/* Must sit ABOVE ContextProvider: TokenContextProvider → useWallet
                    → useSendMoney calls useTranslations, so the intl context has to
                    exist by the time ContextProvider renders. */}
                <IntlProvider>
                    <ContextProvider>
                        <FooterVisibilityProvider>
                            <TranslationSafeWrapper>
                                <ConsoleGreeting />
                                <ScreenOrientationLocker />
                                {HarnessBootstrap && (
                                    <Suspense fallback={null}>
                                        <HarnessBootstrap />
                                    </Suspense>
                                )}
                                {marketing ? children : <AppGlobals>{children}</AppGlobals>}
                            </TranslationSafeWrapper>
                        </FooterVisibilityProvider>
                    </ContextProvider>
                </IntlProvider>
            </PeanutProvider>
        </NuqsAdapter>
    )
}
