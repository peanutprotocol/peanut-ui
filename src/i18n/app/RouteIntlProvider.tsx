'use client'

import { NextIntlClientProvider } from 'next-intl'
import type { AppLocale } from './config'
import { onIntlError } from './intl-error'
import type { AppMessages } from './messages'
import { marketingBase } from './messages.marketing'

/**
 * Pins next-intl to a localized marketing page's URL locale.
 *
 * The provider in ClientProviders sits above every route, so it cannot see the
 * locale segment: it renders English on the server and then swaps to the
 * device / app-cookie locale. On /pt-br that put English copy in the static
 * HTML and then, on a Spanish phone, Spanish copy on a Portuguese page. This
 * nested provider shadows it for the page subtree with the catalog the server
 * loaded for the URL, so SSR, hydration and every later render agree. The app
 * locale itself (useAppLocale, the cookie, analytics) is untouched.
 *
 * Inside this subtree the content language is `useLocale()`, not `useAppLocale()`.
 */
export function RouteIntlProvider({
    locale,
    messages,
    children,
}: {
    locale: AppLocale
    /** Omitted for English, which ships in the bundle as marketingBase. */
    messages?: AppMessages
    children: React.ReactNode
}) {
    return (
        <NextIntlClientProvider
            locale={locale}
            messages={messages ?? marketingBase}
            timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
            onError={onIntlError}
        >
            {children}
        </NextIntlClientProvider>
    )
}
