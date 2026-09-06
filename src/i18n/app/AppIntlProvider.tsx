'use client'

import { IntlCore } from './IntlCore'
import { loadMessages } from './messages'
import en from './messages/en.json'

export { useAppLocale } from './locale-context'

/**
 * Full app catalog. Loaded as its own chunk on app routes only — importing this
 * module pulls all 129 KB of copy, which the marketing site has no use for.
 */
export function AppIntlProvider({ children }: { children: React.ReactNode }) {
    return (
        <IntlCore base={en} load={loadMessages} gatesSplash>
            {children}
        </IntlCore>
    )
}
