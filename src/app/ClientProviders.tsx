'use client'

/**
 * wrapper for client-side providers
 *
 * groups all client providers in one place, keeping the root layout clean.
 * the root layout (server component) renders this single client boundary.
 */
import { ConsoleGreeting } from '@/components/Global/ConsoleGreeting'
import RainCooldownIntroModal from '@/components/Global/RainCooldown/IntroModal'
import StaleCardApprovalReEnableModal from '@/components/Global/StaleCardApproval/ReEnableModal'
import StaleDeploymentReload from '@/components/Global/StaleDeploymentReload'
import BadgeEarnToast from '@/components/Badges/BadgeEarnToast'
import { AppLockGate } from '@/components/Global/AppLock'
import { ScreenOrientationLocker } from '@/components/Global/ScreenOrientationLocker'
import { TranslationSafeWrapper } from '@/components/Global/TranslationSafeWrapper'
import { AppIntlProvider } from '@/i18n/app/AppIntlProvider'
import { PeanutProvider } from '@/config/peanut.config'
import { ContextProvider } from '@/context/contextProvider'
import { FooterVisibilityProvider } from '@/context/footerVisibility'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { HARNESS_ENABLED } from '@/constants/harness.consts'
import { useNativeAppLinks } from '@/hooks/useNativeAppLinks'
import { useOtaUpdates } from '@/hooks/useOtaUpdates'
import { useSplashGate } from '@/hooks/useSplashGate'
import { useZeroLegacyAndroidSafeAreaInsets } from '@/hooks/useZeroLegacyAndroidSafeAreaInsets'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { PeanutDebug } from '@/context/PeanutDebug'

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

export function ClientProviders({ children }: { children: React.ReactNode }) {
    // initialize capgo ota updates (calls notifyAppReady on mount, no-op on web)
    useOtaUpdates()
    useSplashGate()
    // App Links + push-tap routing must be registered on EVERY cold-start
    // destination (including logged-out /setup), hence here and not (mobile-ui).
    useNativeAppLinks()
    useZeroLegacyAndroidSafeAreaInsets()

    return (
        <NuqsAdapter>
            <PeanutProvider>
                {/* Must sit ABOVE ContextProvider: TokenContextProvider → useWallet
                    → useSendMoney calls useTranslations, so the intl context has to
                    exist by the time ContextProvider renders. */}
                <AppIntlProvider>
                    <ContextProvider>
                        <FooterVisibilityProvider>
                            <TranslationSafeWrapper>
                                <ConsoleGreeting />
                                <ScreenOrientationLocker />
                                <PeanutDebug />
                                {/* Mounted here (not in a route-group layout) so the cooldown
                                explainer also covers public pay/send/request pages —
                                the rain:cooldown event fires on every spend path. */}
                                <RainCooldownIntroModal />
                                {/* Global recovery prompt: a withdraw refused with 409
                                STALE_CARD_APPROVAL (stale session-key approval) fires
                                RAIN_STALE_APPROVAL_EVENT — mount here so the re-enable
                                CTA covers every spend path, not just the card screen. */}
                                <StaleCardApprovalReEnableModal />
                                {/* Non-intrusive "badge unlocked" toast on /home (TASK-19791).
                                Global so it surfaces wherever the user lands after earning. */}
                                <BadgeEarnToast />
                                {/* Mounted inside the providers (not called in this
                                component's body like useOtaUpdates) because it
                                reads the query client, redux and loading-state
                                context to know when a reload is safe. */}
                                <StaleDeploymentReload />
                                {HarnessBootstrap && (
                                    <Suspense fallback={null}>
                                        <HarnessBootstrap />
                                    </Suspense>
                                )}
                                {/* Wraps rather than sits beside the page: while the
                                    native app is locked, nothing protected renders. */}
                                <AppLockGate>{children}</AppLockGate>
                            </TranslationSafeWrapper>
                        </FooterVisibilityProvider>
                    </ContextProvider>
                </AppIntlProvider>
            </PeanutProvider>
        </NuqsAdapter>
    )
}
