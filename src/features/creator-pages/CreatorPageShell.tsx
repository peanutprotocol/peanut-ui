import type { ReactNode } from 'react'
import { HtmlLang } from '@/components/Marketing/HtmlLang'
import { HREFLANG_MAP } from '@/i18n/config'
import { CreatorPageProvider } from './CreatorPageProvider'
import type { CreatorPageVariantProps } from './variant-props'

/**
 * The root element of every creator page variant, a server component. It stays synchronous, and
 * so does every variant: `selectCreatorPage` reads the request and passes the result in.
 */
export function CreatorPageShell({
    page: { deviceOs, liftCta, locale, ...page },
    className,
    children,
}: {
    page: CreatorPageVariantProps
    className?: string
    children: ReactNode
}) {
    return (
        <CreatorPageProvider page={page} deviceOs={deviceOs}>
            {/* As on the localized landing pages: the root layout ships lang="en", and this
                corrects <html lang> to the page language after hydration. */}
            <HtmlLang locale={locale} />
            {/* `data-lift-cta` is in the first HTML, so the button does not jump when scripts load.
                Each page's stylesheet turns it into the extra space under its bottom button. */}
            <main lang={HREFLANG_MAP[locale]} className={className} data-lift-cta={liftCta ? '' : undefined}>
                {children}
            </main>
        </CreatorPageProvider>
    )
}
