'use client'

import { IntlCore } from './IntlCore'
import { loadMarketingMessages, marketingBase } from './messages.marketing'

export { useAppLocale } from './locale-context'

/**
 * Marketing-site catalog: only the namespaces the landing page and the
 * localized marketing pages reach. Locale switching behaves exactly as on app
 * routes — the subsets are generated per locale — it just carries ~10 KB of
 * copy instead of 129 KB.
 */
export function MarketingIntlProvider({ children }: { children: React.ReactNode }) {
    return (
        <IntlCore base={marketingBase} load={loadMarketingMessages}>
            {children}
        </IntlCore>
    )
}
