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
import BadgeEarnToast from '@/components/Badges/BadgeEarnToast'
import { ScreenOrientationLocker } from '@/components/Global/ScreenOrientationLocker'
import { TranslationSafeWrapper } from '@/components/Global/TranslationSafeWrapper'
import { PeanutProvider } from '@/config/peanut.config'
import { ContextProvider } from '@/context/contextProvider'
import { FooterVisibilityProvider } from '@/context/footerVisibility'
import { HARNESS_ENABLED } from '@/constants/harness.consts'
import { useOtaUpdates } from '@/hooks/useOtaUpdates'
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

export function ClientProviders({ children }: { children: React.ReactNode }) {
    // initialize capgo ota updates (calls notifyAppReady on mount, no-op on web)
    useOtaUpdates()

    return (
        <NuqsAdapter>
            <PeanutProvider>
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
                            {HarnessBootstrap && (
                                <Suspense fallback={null}>
                                    <HarnessBootstrap />
                                </Suspense>
                            )}
                            {children}
                        </TranslationSafeWrapper>
                    </FooterVisibilityProvider>
                </ContextProvider>
            </PeanutProvider>
        </NuqsAdapter>
    )
}
