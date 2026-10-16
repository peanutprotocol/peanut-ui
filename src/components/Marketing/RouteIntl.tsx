import { resolveLocale } from '@/i18n/app/config'
import type { AppMessages } from '@/i18n/app/messages'
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
    // English is already in the client bundle as marketingBase; don't resend it
    if (appLocale === 'en') return <RouteIntlProvider locale={appLocale}>{children}</RouteIntlProvider>

    // send the whole catalog so a new namespace can't silently fall back to raw
    // keys. only `errors` is dropped: AuthProvider, above this tree, is its one reader.
    const { errors: _errors, ...messages } = await loadMarketingMessages(appLocale)
    return (
        <RouteIntlProvider locale={appLocale} messages={messages as AppMessages}>
            {children}
        </RouteIntlProvider>
    )
}
