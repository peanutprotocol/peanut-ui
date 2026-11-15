import type { Viewport } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { CreatorPagePreview } from '@/features/creator-pages/CreatorPagePreview'
import { deviceOs } from '@/features/creator-pages/environment'
import { creatorPageComponent } from '@/features/creator-pages/page-components'
import { creatorPageFixture } from '@/features/creator-pages/preview-fixture'

// The root layout locks zoom for the app. A creator page is a public page with small legal text,
// so the visitor can pinch-zoom it; /go needs the same export when it renders the page.
export const viewport: Viewport = { maximumScale: 5, userScalable: true }

/**
 * One variant from a fixture, rendered by a server component as on /go, with the label of the
 * requesting device. It is not the whole /go path: the engine's CreatorPageBoundary (an error
 * boundary and a Suspense) is absent here. e2e/flows/creator-pages.spec.ts covers the real route.
 * CreatorPagePreview switches the events and the cookie off.
 */
export default async function CreatorPagePreviewRoute({
    params,
}: {
    params: Promise<{ username: string; variant: string }>
}) {
    const [{ username, variant }, requestHeaders] = await Promise.all([params, headers()])
    const Page = creatorPageComponent(username, variant)
    if (!Page) notFound()

    return (
        <CreatorPagePreview>
            <Page
                {...creatorPageFixture(username, variant)}
                deviceOs={deviceOs(requestHeaders.get('user-agent') ?? '')}
            />
        </CreatorPagePreview>
    )
}
