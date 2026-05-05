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
import { PeanutProvider } from '@/config'
import { ContextProvider } from '@/context'
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
