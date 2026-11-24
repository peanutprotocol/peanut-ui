import type { ReactNode } from 'react'
import { CreatorPageProvider } from './CreatorPageProvider'
import type { CreatorPageVariantProps } from './variant-props'

/**
 * The root element of every creator page variant, a server component. It stays synchronous, and
 * so does every variant: `selectCreatorPage` reads the request and passes the result in.
 */
export function CreatorPageShell({
    page: { deviceOs, liftCta, ...page },
    lang,
    className,
    children,
}: {
    page: CreatorPageVariantProps
    lang: string
    className?: string
    children: ReactNode
}) {
    return (
        <CreatorPageProvider page={page} deviceOs={deviceOs}>
            {/* `data-lift-cta` is in the first HTML, so the button does not jump when scripts load.
                Each page's stylesheet turns it into the extra space under its bottom button. */}
            <main lang={lang} className={className} data-lift-cta={liftCta ? '' : undefined}>
                {children}
            </main>
        </CreatorPageProvider>
    )
}
