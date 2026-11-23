import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { DEV_ROUTES_ENABLED } from '@/constants/dev-tools.consts'
import { CreatorPagePreview } from '@/features/creator-pages/CreatorPagePreview'
import { coversPageBottom, deviceOs } from '@/features/creator-pages/environment'
import { creatorPageExperiment } from '@/features/creator-pages/experiments'
import { creatorPageComponent } from '@/features/creator-pages/page-components'
import { creatorPageFixture } from '@/features/creator-pages/preview-fixture'

export const dynamic = 'force-dynamic'

type PreviewRouteProps = { params: Promise<{ username: string; variant: string }> }

export async function generateMetadata({ params }: PreviewRouteProps): Promise<Metadata> {
    const title = creatorPageExperiment((await params).username)?.title
    return { ...(title ? { title } : {}), robots: { index: false, follow: false } }
}

/**
 * One variant, picked by the URL instead of the split, with the label of the requesting device.
 * It sends no event, sets no cookie and its button follows the plain link. A 404 on peanut.me,
 * like the /dev pages; it answers on localhost, staging and Vercel previews.
 */
export default async function CreatorPagePreviewRoute({ params }: PreviewRouteProps) {
    if (!DEV_ROUTES_ENABLED) notFound()
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
