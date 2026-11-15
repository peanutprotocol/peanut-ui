// Owned by the creator-pages work (TASK-24893). The /go engine created this file as a stub and imports
// `selectCreatorPage` and `CreatorPageSelection` from it; only the creator-pages work edits it.
// Seam: mono inbox/go-links/coordination.md, "Contract" (FROZEN v1).
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import type { ComponentType } from 'react'
import { creatorPageExperiment } from './experiments'
import { creatorPageComponent } from './page-components'
import { pickVariant } from './pick-variant'
import type { CreatorPageProps } from './types'
import { variantCookieName } from './variant-cookie'

/** The seam with the /go engine (go-links contract v1). The engine imports nothing else from this folder. */
export type CreatorPageSelection = {
    /** `^[a-z0-9][a-z0-9-]{0,31}$`, e.g. `a1`. The engine records it as `page_variant` on tracked_link_visit. */
    variant: string
    /** Same pattern. The engine records it as `page_experiment`. */
    experimentId: string
    /** `null` is the contract's control arm (today's redirect). No experiment here uses one. */
    Page: ComponentType<CreatorPageProps> | null
    metadata?: Metadata
}

/**
 * Server only. Reads the variant cookie and never sets it: Next forbids cookies().set during
 * a page render, so CreatorPageShell writes it in the browser.
 */
export async function selectCreatorPage(creator: {
    username: string
    linkId: string
}): Promise<CreatorPageSelection | null> {
    // Keyed by username, not linkId as the contract first said (deviation announced in the go-links
    // coordination notes): a link id differs per environment, so a linkId key would show the page in one only.
    const experiment = creatorPageExperiment(creator.username)
    if (!experiment) return null
    const cookieValue = (await cookies()).get(variantCookieName(creator.username))?.value
    // One draw per request. Drawing inside the lookup re-rolled for every variant and skewed the split.
    const variant = pickVariant(experiment, cookieValue)
    const Page = variant && creatorPageComponent(creator.username, variant)
    return Page ? { variant, experimentId: experiment.id, Page } : null
}
