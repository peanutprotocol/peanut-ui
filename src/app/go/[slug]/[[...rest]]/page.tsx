import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { selectCreatorPage, type CreatorPageSelection } from '@/features/creator-pages/registry'
import {
    bareGoVisit,
    goHandoffPath,
    isAcquisitionSlug,
    isGoPageLabel,
    parseGoRequest,
    TRACKED_LINK_ORIGIN,
    type CreatorPageProps,
    type GoVisit,
} from '@/features/tracked-links/contract'
import { e2eCreatorPage } from '@/features/tracked-links/e2e-creator-page'
import { resolveGoRedirect } from '@/features/tracked-links/go-map'
import { lookupInviteLink } from '@/features/tracked-links/server'
import CreatorPageBoundary from '@/features/tracked-links/CreatorPageBoundary'
import TrackedLinkEntry from '@/features/tracked-links/TrackedLinkEntry'

// No loading.tsx or Suspense above the redirects: either would turn the 307 and 404 answers into soft 200s.
export const dynamic = 'force-dynamic'

type GoPageProps = {
    params: Promise<{ slug: string; rest?: string[] }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Primitive keys, so generateMetadata and the page share one lookup and one selection per request.
const lookup = cache(lookupInviteLink)
const select = cache(
    async (username: string, linkId: string) => e2eCreatorPage(linkId) ?? selectCreatorPage({ username, linkId })
)

export async function generateMetadata({ params }: GoPageProps): Promise<Metadata> {
    const { slug, rest = [] } = await params
    const username = slug.toLowerCase()
    const link = isAcquisitionSlug(username) && !resolveGoRedirect([slug, ...rest]) ? await lookup(username) : null
    let selection: CreatorPageSelection | null = null
    try {
        selection = link?.status === 'found' ? await select(username, link.linkId) : null
    } catch {
        // The page itself falls back to the redirect.
    }
    return { ...checked(username, selection)?.metadata, robots: { index: false, follow: false } }
}

export default async function GoPage({ params, searchParams }: GoPageProps) {
    const { slug, rest = [] } = await params
    // A short link wins over a creator with the same username.
    const destination = resolveGoRedirect([slug, ...rest])
    if (destination) redirect(destination)
    const username = slug.toLowerCase()
    if (!isAcquisitionSlug(username)) notFound()
    const link = await lookup(username)
    if (link.status === 'not_found') notFound()
    // An unavailable identity service still reaches the store, without claiming attribution.
    if (link.status === 'unavailable') redirect('/home?app_entry=1')

    let visit: GoVisit
    let selection: CreatorPageSelection | null
    try {
        // A page gets no Request: the query and the Referer header are all the parser reads from one.
        const url = `${TRACKED_LINK_ORIGIN}/go?${queryOf(await searchParams)}`
        visit = parseGoRequest({ url, headers: await headers() }, username, rest) ?? bareGoVisit(username)
        selection = await select(username, link.linkId)
    } catch (error) {
        // A bug in tags or page selection may lose the tags, never the creator link.
        console.error('go link fell back to the bare handoff', error)
        redirect(goHandoffPath(bareGoVisit(username)))
    }
    selection = checked(username, selection)
    const Page = selection?.Page
    // No page, or the control arm: today's redirect, with the arm on the handoff when there is one.
    if (!selection || !Page) redirect(goHandoffPath(visit, selection ?? undefined))

    const { variant, experimentId } = selection
    const props: CreatorPageProps = {
        creator: { username, linkId: link.linkId },
        variant,
        ctaHref: goHandoffPath(visit, { variant, experimentId }),
        visit,
    }
    return (
        <>
            <TrackedLinkEntry handoff={props.ctaHref} />
            <CreatorPageBoundary handoff={props.ctaHref}>
                <Page {...props} />
            </CreatorPageBoundary>
        </>
    )
}

/** A bad label throws where a developer sees it; in production the creator keeps the plain redirect. */
function checked(username: string, selection: CreatorPageSelection | null): CreatorPageSelection | null {
    if (!selection || (isGoPageLabel(selection.variant) && isGoPageLabel(selection.experimentId))) return selection
    const error = new Error(`Creator page selection for ${username} has an invalid variant or experiment id`)
    if (process.env.NODE_ENV !== 'production') throw error
    console.error(error)
    return null
}

function queryOf(search: Record<string, string | string[] | undefined>): URLSearchParams {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) for (const item of [value ?? []].flat()) query.append(key, item)
    return query
}
