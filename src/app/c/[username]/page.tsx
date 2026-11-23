import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { creatorPageExperiment } from '@/features/creator-pages/experiments'
import { creatorInvitePath } from '@/features/creator-pages/invite-path'
import { selectCreatorPage } from '@/features/creator-pages/registry'

// The variant depends on the request's cookie and user agent. No loading.tsx or Suspense above the
// page: either would turn the 307 into a soft 200 and stream the page in a hidden block.
export const dynamic = 'force-dynamic'

type CreatorPageRouteProps = { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: CreatorPageRouteProps): Promise<Metadata> {
    const title = creatorPageExperiment((await params).username.toLowerCase())?.title
    return { ...(title ? { title } : {}), robots: { index: false, follow: false } }
}

/** peanut.me/c/<username>: the creator's landing page, or a 307 to their invite when they have none. */
export default async function CreatorPageRoute({ params }: CreatorPageRouteProps) {
    const username = (await params).username.toLowerCase()
    const selection = await selectCreatorPage(username)
    if (!selection) redirect(creatorInvitePath(username))
    const { Page, props } = selection
    return <Page {...props} />
}
