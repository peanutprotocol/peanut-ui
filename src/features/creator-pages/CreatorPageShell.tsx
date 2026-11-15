import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import type { CreatorPageProps } from '@/features/tracked-links/contract'
import { CreatorPageProvider } from './CreatorPageProvider'
import { deviceOs } from './environment'
import { creatorPageExperiment } from './experiments'

/**
 * The root element of every creator page variant, a server component. It sends no view event:
 * the engine's tracked_link_visit is the only view count (go-links contract v1).
 */
export async function CreatorPageShell({
    page,
    lang,
    className,
    children,
}: {
    page: CreatorPageProps
    lang: string
    className?: string
    children: ReactNode
}) {
    // The visitors are on phones in in-app browsers, where hydration is slow. Deciding the OS here
    // puts the right label and store icon in the first HTML, so nothing changes under the thumb.
    // Presentation only: the event reads the user agent in the browser, at tap time.
    const os = deviceOs((await headers()).get('user-agent') ?? '')

    return (
        <CreatorPageProvider
            page={page}
            experimentId={creatorPageExperiment(page.creator.username)?.id ?? null}
            deviceOs={os}
        >
            <main lang={lang} className={className}>
                {children}
            </main>
        </CreatorPageProvider>
    )
}
