import { resolveLocale } from '@/i18n/app/config'
import type { AppMessages } from '@/i18n/app/messages'
import { loadMarketingMessages } from '@/i18n/app/messages.marketing'
import { RouteIntlProvider } from '@/i18n/app/RouteIntlProvider'
import type { Locale } from '@/i18n/types'

// What the wrapped tree reads: ShhhhhFold / LandingPageClient (shhhhh),
// StickyMobileCTA / LandingDownloadCta (migration), NavHeader (navigation,
// common), Callout / Badge (common). `errors` is only read by AuthProvider,
// which sits above this tree, so sending it would be dead weight in every page.
const ROUTE_NAMESPACES = ['common', 'migration', 'navigation', 'shhhhh'] as const

/**
 * Server half of RouteIntlProvider: loads the marketing catalog for the URL
 * locale at build time (es-ar layers over es-419, like the app catalog), so
 * next-intl copy is already translated in the prerendered HTML.
 */
export async function RouteIntl({ locale, children }: { locale: Locale; children: React.ReactNode }) {
    const appLocale = resolveLocale(locale)
    // English is already in the client bundle as marketingBase; don't resend it
    if (appLocale === 'en') return <RouteIntlProvider locale={appLocale}>{children}</RouteIntlProvider>

    const catalog = await loadMarketingMessages(appLocale)
    const messages = Object.fromEntries(ROUTE_NAMESPACES.map((ns) => [ns, catalog[ns]])) as unknown as AppMessages
    return (
        <RouteIntlProvider locale={appLocale} messages={messages}>
            {children}
        </RouteIntlProvider>
    )
}
