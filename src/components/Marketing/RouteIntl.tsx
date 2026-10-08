import { resolveLocale } from '@/i18n/app/config'
import { loadMarketingMessages } from '@/i18n/app/messages.marketing'
import { RouteIntlProvider } from '@/i18n/app/RouteIntlProvider'
import type { Locale } from '@/i18n/types'

/**
 * Server half of RouteIntlProvider: loads the marketing catalog for the URL
 * locale at build time (es-ar layers over es-419, like the app catalog), so
 * next-intl copy is already translated in the prerendered HTML.
 */
export async function RouteIntl({ locale, children }: { locale: Locale; children: React.ReactNode }) {
    const appLocale = resolveLocale(locale)
    const messages = await loadMarketingMessages(appLocale)
    return (
        <RouteIntlProvider locale={appLocale} messages={messages}>
            {children}
        </RouteIntlProvider>
    )
}
