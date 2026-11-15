import type { Viewport } from 'next'
import { notFound } from 'next/navigation'
import { creatorPageFixture } from '@/features/creator-pages/creator-page-fixture'
import { CreatorPagePreview } from '@/features/creator-pages/CreatorPagePreview'
import { creatorPageComponent } from '@/features/creator-pages/page-components'

// The root layout locks zoom for the app. A creator page is a public page with small legal text,
// so the visitor can pinch-zoom it; /go needs the same export when it renders the page.
export const viewport: Viewport = { maximumScale: 5, userScalable: true }

/**
 * One variant from a fixture. A server component that looks the page up and renders it, the way
 * /go does after selectCreatorPage, so the preview crosses the same server-to-client boundary.
 * CreatorPagePreview switches the events and the cookie off.
 */
export default async function CreatorPagePreviewRoute({
    params,
}: {
    params: Promise<{ creator: string; variant: string }>
}) {
    const { creator, variant } = await params
    const Page = creatorPageComponent(creator, variant)
    if (!Page) notFound()

    return (
        <CreatorPagePreview>
            <Page {...creatorPageFixture(creator, variant)} />
        </CreatorPagePreview>
    )
}
