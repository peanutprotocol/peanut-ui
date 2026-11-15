import type { ReactNode } from 'react'
import { CreatorPageProvider } from './CreatorPageProvider'
import { creatorPageExperiment } from './experiments'
import type { CreatorPageVariantProps } from './variant-props'

/**
 * The root element of every creator page variant, a server component. It sends no view event:
 * the engine counts the view with tracked_link_visit (go-links contract v1).
 *
 * It must stay synchronous, and so must every variant: the engine renders the page inside
 * `<Suspense fallback={null}>`, and anything that suspends there is streamed in a hidden block
 * that only a script reveals. `selectCreatorPage` reads the request instead and passes the result in.
 */
export function CreatorPageShell({
    page: { deviceOs, ...page },
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
        <CreatorPageProvider
            page={page}
            experimentId={creatorPageExperiment(page.creator.username)?.id ?? null}
            deviceOs={deviceOs}
        >
            <main lang={lang} className={className}>
                {children}
            </main>
        </CreatorPageProvider>
    )
}
