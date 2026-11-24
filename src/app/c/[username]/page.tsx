import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { creatorPageExperiment } from '@/features/creator-pages/experiments'
import { creatorInvitePath } from '@/features/creator-pages/invite-path'
import { selectCreatorPage } from '@/features/creator-pages/registry'
import { creatorUsernameFromSegment } from '@/features/creator-pages/route-username'

// The variant depends on the request's cookie and user agent. No loading.tsx or Suspense above the
// page: either would turn the 307 into a soft 200 and stream the page in a hidden block.
export const dynamic = 'force-dynamic'

type CreatorPageRouteProps = { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: CreatorPageRouteProps): Promise<Metadata> {
    const username = creatorUsernameFromSegment((await params).username)
    const title = username ? creatorPageExperiment(username)?.title : undefined
    return { ...(title ? { title } : {}), robots: { index: false, follow: false } }
}

/**
 * peanut.me/c/<username>: the creator's landing page, a 307 to their invite when they have none, or a
 * 404 for a segment that cannot be a username.
 */
export default async function CreatorPageRoute({ params }: CreatorPageRouteProps) {
    const username = creatorUsernameFromSegment((await params).username)
    if (!username) notFound()
    const selection = await selectCreatorPage(username)
    if (!selection) redirect(creatorInvitePath(username))
    const { Page, props } = selection
    return <Page {...props} />
}
