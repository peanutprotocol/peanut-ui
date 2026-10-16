'use client'

import { IntlCore } from './IntlCore'
import { loadMessages } from './messages'
import en from './messages/en.json'
import { useHydrationPathname } from '@/hooks/useHydrationPathname'
import { useNativePlatform } from '@/utils/native-platform'
import Loading from '@/components/Global/Loading'

export { useAppLocale } from './locale-context'

/**
 * Full app catalog. Loaded as its own chunk on app routes only — importing this
 * module pulls all 129 KB of copy, which the marketing site has no use for.
 */
export function AppIntlProvider({ children }: { children: React.ReactNode }) {
    const pathname = useHydrationPathname()
    const { isCapacitor } = useNativePlatform()
    // Native root HTML hydrates at any path; auth and the root redirect must mount before locale resolution.
    const needsStartupFallback =
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true' && !isCapacitor && pathname?.startsWith('/setup')
    return (
        <IntlCore
            base={en}
            load={loadMessages}
            gatesSplash
            startupFallback={needsStartupFallback ? <Loading variant="mascot" coverFullScreen /> : undefined}
        >
            {children}
        </IntlCore>
    )
}
