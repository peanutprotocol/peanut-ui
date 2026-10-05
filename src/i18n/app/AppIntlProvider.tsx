'use client'

import { IntlCore } from './IntlCore'
import { loadMessages } from './messages'
import en from './messages/en.json'
import { usePathname } from 'next/navigation'
import Loading from '@/components/Global/Loading'

export { useAppLocale } from './locale-context'

/**
 * Full app catalog. Loaded as its own chunk on app routes only — importing this
 * module pulls all 129 KB of copy, which the marketing site has no use for.
 */
export function AppIntlProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    return (
        <IntlCore
            base={en}
            load={loadMessages}
            gatesSplash
            startupFallback={pathname?.startsWith('/setup') ? <Loading variant="mascot" coverFullScreen /> : undefined}
        >
            {children}
        </IntlCore>
    )
}
