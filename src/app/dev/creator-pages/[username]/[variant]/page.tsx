import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { CreatorPagePreview } from '@/features/creator-pages/CreatorPagePreview'
import { coversPageBottom, deviceOs } from '@/features/creator-pages/environment'
import { creatorPageExperiment } from '@/features/creator-pages/experiments'
import { creatorPageComponent } from '@/features/creator-pages/page-components'
import { creatorPageFixture } from '@/features/creator-pages/preview-fixture'

// The root layout locks zoom for the app. A creator page is a public page with small legal text,
// so the visitor can pinch-zoom it; /go needs the same export when it renders the page.
export const viewport: Viewport = { maximumScale: 5, userScalable: true }

type RouteProps = { params: Promise<{ username: string; variant: string }> }

// The creator's tab title, from the same field that selectCreatorPage hands the /go engine.
export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
    const title = creatorPageExperiment((await params).username)?.title
    return title ? { title } : {}
}

/**
 * One variant from a fixture, rendered by a server component as on /go, with the label of the
 * requesting device. It is not the whole /go path: the engine's CreatorPageBoundary (an error
 * boundary and a Suspense) is absent here. e2e/flows/creator-pages.spec.ts covers the real route.
 * CreatorPagePreview switches the events and the cookie off.
 */
export default async function CreatorPagePreviewRoute({ params }: RouteProps) {
    const [{ username, variant }, requestHeaders] = await Promise.all([params, headers()])
    const Page = creatorPageComponent(username, variant)
    if (!Page) notFound()
    const userAgent = requestHeaders.get('user-agent') ?? ''

    return (
        <CreatorPagePreview>
            <Page
                {...creatorPageFixture(username, variant)}
                deviceOs={deviceOs(userAgent)}
                liftCta={coversPageBottom(userAgent)}
            />
        </CreatorPagePreview>
    )
}
