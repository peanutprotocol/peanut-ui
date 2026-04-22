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
import { useOtaUpdates } from '@/hooks/useOtaUpdates'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

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
                            {children}
                        </TranslationSafeWrapper>
                    </FooterVisibilityProvider>
                </ContextProvider>
            </PeanutProvider>
        </NuqsAdapter>
    )
}
